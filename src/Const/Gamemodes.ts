import DominationArena from "../Gamemodes/Domination";
import FFAArena from "../Gamemodes/FFA";
import MazeArena from "../Gamemodes/Maze";
import MothershipArena from "../Gamemodes/Mothership";
import SandboxArena from "../Gamemodes/Sandbox";
import Teams2Arena from "../Gamemodes/Team2";
import Teams4Arena from "../Gamemodes/Team4";
import ArenaEntity from "../Native/Arena";

export default {
    "ffa": FFAArena,
    "teams": Teams2Arena,
    "4teams": Teams4Arena,
    "sandbox": SandboxArena,
    "dom": DominationArena,
    "survival": null,
    "tag": null,
    "mot": MothershipArena,
    "maze": MazeArena,
} as Record<string, (typeof ArenaEntity) | null>;