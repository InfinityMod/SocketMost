import { ExplorerServer, REQ_REGISTRY } from './ExplorerServer'
import {
    AllocResult,
    MasterFoundEvent,
    MessageOnly,
    MostRxMessage,
    NodePosition,
    RetrieveAudio,
    SocketMostSendMessage,
    Stream,
    Os8104Events,
} from '../modules/Messages'

const fBlocks: Record<number, string> = {
    0x01: 'NetBlock',
    0x02: 'NetworkMaster',
    0x03: 'ConnectionMaster',
    0x05: 'Vehicle',
    0x06: 'Diagnosis',
    0x07: 'DebugMessages',
    0x0e: 'Tool',
    0x0f: 'EnhancedTestibility',
    0x10: 'Sources',
    0x21: '33',
    0x22: 'Amplifier',
    0x23: '35',
    0x24: 'AuxIn',
    0x26: 'MicrophoneInput',
    0x30: 'AudioTapePlayer',
    0x31: 'AudioDiskPlayer',
    0x34: 'DVDVideoPlayer',
    0x40: 'AmFmTuner',
    0x41: 'TMCTuner',
    0x42: 'TVTuner',
    0x43: 'DABTuner',
    0x44: 'SDARS',
    0x50: 'Telephone',
    0x51: 'GeneralPhoneBook',
    0x60: 'GraphicDisplay',
    0xf5: '245',
    0xf0: '240',
    0x71: 'Climate'
}

export class AutomationServer extends ExplorerServer {
    registry?: Record<string, any> | null = null;
    commandStore?: Record<string, any> | null = null;

    constructor(
        sendControlMessage: (
            message: SocketMostSendMessage,
            telId?: number,
        ) => void,
        getRemoteSource: (connectionLabel: number) => void,
        allocate: () => void,
        stream: (stream: Stream) => void,
        retrieveAudio: (audio: RetrieveAudio) => void
    ) {
        super(sendControlMessage, getRemoteSource, allocate, stream, retrieveAudio);
        this.io.on('connection', socket => {
            console.log('connection');
            socket.on('setAmplifierAudioSink', data => {
                let sink = data.sink;
                this.setAmplifierAudioSink(sink)
            })
        })
    }

    executeStep(command: String, args: any) {
        switch (command) {
            case 'setAmplifierAudioSink':
                this.setAmplifierAudioSink(args);
        }
    }

    setAmplifierAudioSink(sink: number) {
        console.log('Set audio sink: ' + String(sink));
        if (this.registry == null) {
            this.commandStore = { 'cmd': 'setAmplifierAudioSink', 'args': sink };
            // Get registry
            this.sendControlMessage(REQ_REGISTRY);
        } else if ('Amplifier' in this.registry) {
            let amplifier = this.registry.Amplifier;
            this.stream({ sourceAddrHigh: amplifier.address.readUint8(0), sourceAddrLow: amplifier.address.readUint8(1), fBlockID: amplifier.fBlockID, instanceID: amplifier.instanceID, sinkNr: sink });
        } else {
            console.log('Amplifier is missing in registry.');
        }
    }

    newMessageRx(data: MasterFoundEvent | MostRxMessage | MessageOnly | AllocResult | NodePosition): void {
        if (this.registry == null) {
            if (data.eventType == Os8104Events.SocketMostMessageRxEvent && data.type == 2561) {
                this.registry = {}
                console.log('Registry received', data)
                let finalData = data.data.subarray(0, data.telLen)
                for (let i = 0; i < finalData!.length; i += 4) {
                    const tempFblockID = finalData!.readUInt8(i + 2)
                    const readableName = tempFblockID in fBlocks ? fBlocks[tempFblockID] : tempFblockID
                    if (!(readableName in this.registry)) {
                        this.registry[readableName] = []
                    }
                    this.registry[readableName].push({
                        address: finalData!.readUint16BE(i),
                        instanceID: finalData!.readUInt8(i + 3),
                        fBlockID: tempFblockID
                    })
                    console.log(this.registry);
                }
            }
        }

        if (this.commandStore != null) {
            this.executeStep(this.commandStore.cmd, this.commandStore.args)
        }

        super.newMessageRx(data);
    }
}
