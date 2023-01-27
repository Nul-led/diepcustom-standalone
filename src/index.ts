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

import * as WebSocket from "ws";
import * as config from "./config"
import * as util from "./util";
import GameServer from "./Game";
import Gamemodes from "./Const/Gamemodes";

const wss = new WebSocket.Server({
    maxPayload: config.wssMaxMessageSize,
    port: config.serverPort
});

const Gamemode = Gamemodes[config.hostedGamemode];
if (!Gamemode) throw "Unable to load gamemode!";

util.saveToLog("Server up", `Publishing gamemode ${config.hostedGamemode} on port ${config.serverPort}`, 0x00FF00);

new GameServer(wss, Gamemode);

process.on("uncaughtException", (error) => {
    util.saveToLog("Uncaught Exception", '```\n' + error.stack + '\n```', 0xFF0000);
    throw error;
});