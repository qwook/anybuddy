import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";
import { ClientCommandsClient } from "./proto/pb/protos/service.client";
import {
  Rpc_Account_Select_Request,
  Rpc_App_SetDeviceState_Request_DeviceState,
  Rpc_Object_Search_Request,
  Rpc_Wallet_Recover_Request,
} from "./proto/pb/protos/commands";
import { Block_Content_Dataview_Filter } from "./proto/pkg/lib/pb/model/protos/models";
import LaterVille from "./utils/laterville";
import { EventEmitter } from "node:events";

export default class AnyBuddy extends EventEmitter {
  private client: GrpcWebFetchTransport;
  private clientCommands: ClientCommandsClient;
  private token: string = "";
  private techSpaceId: string = "";
  private accountRecoveryWaiters: LaterVille<string>[] = [];
  private hasInitialSetParameters = false;

  constructor(hostname: string = "") {
    super();
    this.client = new GrpcWebFetchTransport({
      baseUrl: hostname,
      fetch: (input: URL | RequestInfo, init: RequestInit | undefined = {}) => {
        const headers = new Headers(init.headers);
        // headers.set("X-Anytype-Version", "2025-05-20");
        init.headers = headers;
        return fetch(input, init);
      },
    });
    this.clientCommands = new ClientCommandsClient(this.client);
  }

  private async listenToStream(token: string) {
    const streamingListenSession = this.clientCommands.listenSessionEvents({
      token: token,
    });
    for await (let response of streamingListenSession.responses) {
      for (const message of response.messages) {
        // Some stupid async event.
        if (message.value.oneofKind === "accountShow") {
          const id = message.value.accountShow.account?.id;
          if (id) {
            this.accountRecoveryWaiters.forEach((promise) =>
              promise.resolve(id),
            );
            this.accountRecoveryWaiters.splice(
              0,
              this.accountRecoveryWaiters.length,
            );
            return;
          }
        } else {
          console.log(message.value);
        }
      }
    }
  }

  private async initialSetParamters() {
    if (!this.hasInitialSetParameters) {
      this.hasInitialSetParameters = true;
      await this.clientCommands.initialSetParameters({
        platform: "MacOS",
        version: "0.0.1",
        workdir: "./mm",
        logLevel: "",
        doNotSaveLogs: true,
        doNotSendTelemetry: true,
        doNotSendLogs: true,
      });
    }
  }

  async authenticate(mnemonic: string): Promise<string> {
    await this.initialSetParamters();

    await this.clientCommands.walletRecover(
      Rpc_Wallet_Recover_Request.create({
        rootPath: "./mm",
        mnemonic,
      }),
    );

    const session = await this.clientCommands.walletCreateSession({
      auth: {
        oneofKind: "mnemonic",
        mnemonic,
      },
    });

    return session.response.token;
  }

  async login(token: string) {
    await this.initialSetParamters();

    this.token = token;
    this.listenToStream(this.token);

    const waitForAccountRecovery = new LaterVille<string>();
    this.accountRecoveryWaiters.push(waitForAccountRecovery);

    await this.clientCommands.accountRecover(
      {},
      {
        meta: {
          token: this.token,
        },
      },
    );

    const accountString = await waitForAccountRecovery;

    const select = await this.clientCommands.accountSelect(
      Rpc_Account_Select_Request.create({
        id: accountString,
        rootPath: "./mmz",
      }),
      { meta: { token: this.token } },
    );

    const techSpaceId = select.response.account?.info?.techSpaceId;
    if (!techSpaceId) return;

    this.techSpaceId = techSpaceId;
  }

  private checkToken() {
    if (!this.checkToken) {
      throw "No token. Have you ran .login() yet?";
    }
  }

  async getSpaces() {
    this.checkToken();

    const response = await this.clientCommands.objectSearch(
      Rpc_Object_Search_Request.create({
        spaceId: this.techSpaceId,
        filters: [
          Block_Content_Dataview_Filter.create({
            relationKey: "resolvedLayout",
            condition: 1,
            value: { kind: { oneofKind: "numberValue", numberValue: 18 } },
          }),
        ],
        keys: ["targetSpaceId", "name", "spaceLocalStatus"],
        sorts: [],
        objectTypeFilter: [],
        limit: 5,
        offset: 0,
      }),
      { meta: { token: this.token } },
    );
    if (response.status.code !== "OK") {
      throw response.response.error;
    }
    return response.response;
  }
}
