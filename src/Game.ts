/*
    DiepCustom - custom tank game server that shares diep.io's WebSocket protocol
    Copyright (C) 2022 ABCxFF (github.com/ABCxFF)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>
*/

import * as config from "./config";
import * as util from "./util";
import { Server } from "ws";

import Writer from "./Coder/Writer";
import EntityManager from "./Native/Manager";
import Client from "./Client";

import ArenaEntity, { ArenaState } from "./Native/Arena";

import { ClientBound } from "./Const/Enums";
import { IncomingMessage } from "http";
import WebSocket = require("ws");

/**
 * WriterStream that broadcasts to all of the game's WebSockets.
 */
class WSSWriterStream extends Writer {
    private game: GameServer;

    public constructor(game: GameServer) {
        super();
        this.game = game;
    }

    public send() {
        const bytes = this.write();

        for (let client of this.game.clients) {
            client.ws.send(bytes);
        }
    }
}

/**
 * Used for determining which endpoints go to the default.
 */
export default class GameServer {
    /** Stores total player count. */
    public static globalPlayerCount: number = 0;

    /** Whether or not the game server is running. */
    public running: boolean = false;

    /** Whether or not to put players on the map. */
    public playersOnMap: boolean = false;

    /** Inner WebSocket Server. */
    private wss: Server;

    /** The game's gamemode */
    public GameMode: typeof ArenaEntity;

    /** Contains count of each ip. */
    public ipCache: Map<string, number> = new Map<string, number>();

    /** All clients connected. */
    public clients: Set<Client> = new Set<Client>();

    /** Entity manager of the game. */
    public entities: EntityManager = new EntityManager(this);

    /** The current game tick. */
    public tick: number = 0;

    /** The game's arena entity. */
    public arena: ArenaEntity;

    /** The interval timer of the tick loop. */
    private _tickInterval: NodeJS.Timeout | null = null;

    public constructor(wss: Server, GameMode: typeof ArenaEntity) {
        this.wss = wss;
        this.GameMode = GameMode;
        this.arena = new GameMode(this);

        // Keeps player count updating per addition
        this.clients.add = (client: Client) => {
            ++GameServer.globalPlayerCount;
            this.broadcastPlayerCount();
            return Set.prototype.add.call(this.clients, client);
        }

        this.clients.delete = (client: Client) => {
            const success = Set.prototype.delete.call(this.clients, client);
            if (success) {
                --GameServer.globalPlayerCount;
                this.broadcastPlayerCount();
            }
            return success;
        }

        this.clients.clear = () => {
            GameServer.globalPlayerCount -= this.clients.size;
            this.broadcastPlayerCount();
            Set.prototype.clear.call(this.clients);
        }

        this.listen();

        this.start();
    }

    /** Sets up listeners */
    private listen() {
        this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
            util.log("Incoming client");

            if (!this.arena || !this.running || this.arena.state !== ArenaState.OPEN) {
                util.log("Arena is not open: Closing client");
                return ws.terminate();
            }

            const ipPossible = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "";
            const ipList = Array.isArray(ipPossible) ? ipPossible : ipPossible.split(',').map(c => c.trim());
            const ip = ipList[ipList.length - 1] || "";
            if ((ip !== ipList[0] || !ip) && config.mode !== "development") return req.destroy(new Error("Client ips dont match."));

            const concurrentConnections = this.ipCache.get(ip) || 0;
            const isBanned = concurrentConnections === Infinity;
            const connectionLimitReached = config.connectionsPerIp !== -1 && concurrentConnections > config.connectionsPerIp;
            if (isBanned || connectionLimitReached) return req.destroy();

            this.ipCache.set(ip, concurrentConnections + 1);
            this.clients.add(new Client(this, ws, ip));
        });
    }

    /** Returns a WebSocketServer Writer Broadcast Stream. */
    public broadcast() {
        return new WSSWriterStream(this);
    }

    /** Broadcasts a player count packet. */
    public broadcastPlayerCount() {
        this.broadcast().vu(ClientBound.PlayerCount).vu(GameServer.globalPlayerCount).send();
    }

    /** Ends the game instance. */
    public end(doRestart: boolean = true) {
        util.log(`${doRestart ? "Restarting" : "Ending"} Game Instance.`);

        if(this._tickInterval) clearInterval(this._tickInterval);
        this._tickInterval = null;

        for (const client of this.clients) {
            client.terminate();
        }

        this.clients.clear();
        this.entities.clear();
        this.ipCache.clear();

        this.running = false;
        this.playersOnMap = false;

        if(doRestart) this.start();
    }

    /** Initializes a game instance */
    public start() {
        if (this.running) return;

        util.log("New game instance booting up");

        this.arena = new this.GameMode(this);

        this.tick = 0;
        this._tickInterval = setInterval(() => {
            if (this.clients.size) this.tickLoop();
        }, config.mspt);

        this.running = true;
        this.playersOnMap = true;
    }

    /** Ticks the game. */
    private tickLoop() {
        ++this.tick;
        this.entities.tick(this.tick);
        for (const client of this.clients) client.tick(this.tick);
    }
}