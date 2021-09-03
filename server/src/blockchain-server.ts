import { request } from 'express';
import WebSocket from 'ws';
import { Message, MessageTypes, UUID} from './message';
import { MessageServer } from './message-server';

type Replies = Map<WebSocket, Message>;

export class BlockchainServer extends MessageServer<Message>{
    private readonly receivedMessagesAwaitingResponse = new Map<UUID, WebSocket>();

    private readonly sentMessagesAwatingReply = new Map<UUID, Replies>();

    protected handleMessage(sender: WebSocket, message: Message): void {
        switch(message.type){
            case MessageTypes.GetLongestChainRequest:
                return this.handleGetLongestChainRequest(sender, message);
            case MessageTypes.GetLongestChainResponse:
                return this.handleGetLongestChainResponse(sender, message);
            case MessageTypes.NewBlockRequest:
                return this.handleAddTransactionsRequest(sender,message);
            case MessageTypes.NewBlockAnnouncement:
                return this.handleNewBlockAnnouncement(sender,message);
            default: {
                console.log(`Received message of unknown type: "${message.type}"`)
            }
        }
    }

    private handleGetLongestChainRequest(requestor: WebSocket, message:Message) : void {
        if(this.clientIsNotAlone){
            this.receivedMessagesAwaitingResponse.set(message.correlationId, requestor);
            this.sentMessagesAwatingReply.set(message.correlationId, new Map());
            this.broadcastExcept(requestor,message);
        } else {
            this.replyTo(requestor, {
                type:MessageTypes.GetLongestChainResponse,
                correlationId : message.correlationId,
                payload: []
            });
        }
    }

    private handleGetLongestChainResponse(sender:WebSocket, message:Message): void{
        if(this.receivedMessagesAwaitingResponse.has(message.correlationId)){
            const requestor= this.receivedMessagesAwaitingResponse.get(message.correlationId);

            if(this.everyoneReplied(sender,message)){
                const allReplies = this.sentMessagesAwatingReply.get(message.correlationId)!.values();
                const longestChain = Array.from(allReplies).reduce(this.selectTheLongestChain);

                this.replyTo(requestor!, longestChain);
            }
        }
    }

    private handleAddTransactionsRequest(requestor: WebSocket, message: Message): void {
        this.broadcastExcept(requestor, message);
    }

    private handleNewBlockAnnouncement(requestor: WebSocket, message: Message): void{
        this.broadcastExcept(requestor,message);
    }

    private everyoneReplied(sender: WebSocket, message: Message): boolean {
        const repliedClients = this.sentMessagesAwatingReply
        .get(message.correlationId)!
        .set(sender,message);
        const awaitingForClient = Array.from(this.clients).filter(c => !repliedClients.has(c));

        return awaitingForClient.length === 1;
    }

    private selectTheLongestChain(currentlyLongest: Message,
        current: Message,index: number){
            return index > 0 && current.payload.length > currentlyLongest.payload.length ? current:
            currentlyLongest;
        }

    private get clientIsNotAlone(): boolean{
        return this.clients.size > 1;
    }
}