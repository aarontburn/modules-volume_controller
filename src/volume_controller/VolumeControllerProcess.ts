import * as path from "path";
import { Process } from "./module_builder/Process";
import { IPCCallback } from "./module_builder/IPCObjects";
import { NodeAudioVolumeMixer } from "node-audio-volume-mixer";
import { Setting } from "./module_builder/Setting";
import { BooleanSetting } from "./module_builder/settings/types/BooleanSetting";
import { exec as lameExec } from 'child_process'
import { promisify } from 'util';
import SoundMixer, { AudioSession, Device, DeviceType } from "native-sound-mixer";
import { SessionController } from "./SessionController";

const exec = promisify(lameExec);


interface Session {
    pid: number,
    name: string,
    volume: number,
    isMuted: boolean

}


export class VolumeControllerProcess extends Process {

    private static MODULE_NAME = "Volume Controller";

    // Modify this to match the path of your HTML file.
    /** @htmlpath */
    private static HTML_PATH: string = path.join(__dirname, "./VolumeControllerHTML.html").replace("dist", "src");


    private static VOLUME_REFRESH_MS = 500;

    private refreshTimeout: NodeJS.Timeout;

    public constructor(ipcCallback: IPCCallback) {
        super(VolumeControllerProcess.MODULE_NAME, VolumeControllerProcess.HTML_PATH, ipcCallback);
    }

    public initialize(): void {
        super.initialize()
        // Get a audio session.



        this.updateSessions();
    }


    private async updateSessions() {
        // Master
        const masterInfo: { isMuted: boolean, volume: number } = {
            isMuted: SessionController.isMasterMuted(),
            volume: SessionController.getMasterVolume()
        };

        this.notifyObservers('master-update', masterInfo);


        // Individual sessions
        await SessionController.getSessions().then((sessions: Session[]) => {
            this.notifyObservers("vol-sessions", sessions);
            this.refreshTimeout = setTimeout(() => this.updateSessions(), VolumeControllerProcess.VOLUME_REFRESH_MS);
        });


    }



    public registerSettings(): Setting<unknown>[] {
        return [
            new BooleanSetting(this)
                .setName("Show Session PID")
                .setDescription("Displays the process ID of the session.")
                .setDefault(false)

        ];
    }


    public refreshSettings(): void {
        this.notifyObservers("session-pid-visibility-modified", this.getSettings().getSettingByName("Show Session PID").getValue());
    }

    public stop(): void {
        clearTimeout(this.refreshTimeout);
    }



    public receiveIPCEvent(eventType: string, data: any[]): void {
        switch (eventType) {
            case "init": {
                this.initialize();
                break;
            }
            case "volume-modified": {
                const sessionPID: number = Number(data[0]);
                const newVolume: number = Number(data[1]) / 100;
                console.log("PID: " + data[0] + " New Volume: " + data[1])
                SessionController.setSessionVolume(sessionPID, newVolume);
                break;
            }
            case "session-muted": {
                const sessionPID: number = Number(data);
                SessionController.setSessionMute(sessionPID, !SessionController.isSessionMuted(sessionPID));
                console.log("Toggling mute for session: " + sessionPID);
                break;
            }
            case "session-solo": {
                const sessionPID: number = Number(data);
                SessionController.toggleSolo(sessionPID);
                break;
            }
            case "master-volume-modified": {
                const newMasterVolume: number = Number(data[0]);
                SessionController.setMasterVolume(newMasterVolume / 100);
                break;
            }
            case 'session-mute-state': {
                const isMasterMuted: boolean = Boolean(data[0]);
                SessionController.setMasterMute(isMasterMuted);

                break;
            }

        }
    }








}