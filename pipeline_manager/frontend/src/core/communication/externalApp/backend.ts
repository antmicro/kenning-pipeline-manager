import {
    JSONRPCRequest, JSONRPCResponse, JSONRPCServerAndClient,
} from 'json-rpc-2.0';
import { io, Socket } from 'socket.io-client';
import ExternalApp, { EndpointType } from './base';
import { ClientParams } from '../utils';
import NotificationHandler from '../../notifications';

export default class ExternalBackendApp implements ExternalApp {
    public static commonHeaders = {
        'Access-Control-Allow-Origin': 'http://localhost',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
    };

    private socket: Socket;

    // eslint-disable-next-line no-useless-constructor
    public constructor(
        public url: string,
        private jsonRPC: JSONRPCServerAndClient<void, ClientParams>,
        private maxMessageLength = 256 * 1024,
    ) {
        this.socket = io(url, { extraHeaders: ExternalBackendApp.commonHeaders });

        this.socket.on('connect', () => NotificationHandler.terminalLog('info', 'Initialized connection with communication server', null));
        this.socket.on('disconnect', () => {
            NotificationHandler.terminalLog('warning', 'Connection with communication server disrupted', null);
            this.jsonRPC.rejectAllPendingRequests('WebSocket disconnected');
        });

        this.socket.on('api', async (data: JSONRPCRequest) => {
            const response = await this.jsonRPC.server.receive(data);
            if (response) {
                try {
                    const ack = await this.socket.emitWithAck('external-api', response);
                    if (ack !== undefined && !ack) {
                        NotificationHandler.terminalLog('error', 'Response to external app was not send', null);
                    }
                } catch (error) {
                    NotificationHandler.terminalLog('error', `Response to ${data.method} request cannot be send`, error);
                }
            }
        });
        this.socket.on('api-response', (response: JSONRPCResponse) => { this.jsonRPC.client.receive(response); });
    }

    public request(data: JSONRPCRequest, endpoint: EndpointType) {
        if (this.socket.disconnected) throw new Error('WebSocket is disconnected. Make sure the communication server is available.');

        const stringify = JSON.stringify(data);

        // Emit request in chunks
        if (stringify.length > this.maxMessageLength) {
            const messageID = data.id ?? crypto.randomUUID();
            for (let i = 0; i < stringify.length; i += this.maxMessageLength) {
                this.socket.emit(endpoint, {
                    id: messageID,
                    chunk: stringify.substring(
                        i, Math.min(i + this.maxMessageLength, stringify.length),
                    ),
                    end: i + this.maxMessageLength >= stringify.length,
                });
            }
        // Emit whole request
        } else {
            this.socket.emit(endpoint, data);
        }
    }
}
