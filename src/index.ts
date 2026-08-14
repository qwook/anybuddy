import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";
import { ClientCommandsClient } from "./proto/pb/protos/service.client";
import {
  Rpc_Account_Select_Request,
  Rpc_App_SetDeviceState_Request_DeviceState,
  Rpc_File_Download_Request,
  Rpc_Object_Close_Request,
  Rpc_Object_Open,
  Rpc_Object_Open_Request,
  Rpc_Object_Search_Request,
  Rpc_Object_SearchSubscribe_Request,
  Rpc_Object_Show_Request,
  Rpc_Wallet_Recover_Request,
} from "./proto/pb/protos/commands";
import {
  Block,
  Block_Content,
  Block_Content_Dataview_Filter,
  Block_Content_Dataview_Filter_Condition,
  Block_Content_Dataview_Sort,
  Block_Content_File_Type,
  Detail,
  Layout,
  ObjectType_Layout,
  ObjectView_DetailsSet,
  SmartBlockType,
} from "./proto/pkg/lib/pb/model/protos/models";
import LaterVille from "./utils/laterville";
import { ListValue, Value } from "./proto/google/protobuf/struct";
import { WidgetBlock } from "./proto/pb/protos/snapshot";

export default class AnyBuddy extends EventTarget {
  private client: GrpcWebFetchTransport;
  private clientCommands: ClientCommandsClient;
  private token: string = "";
  private techSpaceId: string = "";
  private accountRecoveryWaiters: LaterVille<string>[] = [];
  private hasInitialSetParameters = false;
  private files: string;

  constructor(hostname: string = "", files = "") {
    super();
    this.files = files;
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
            condition: Block_Content_Dataview_Filter_Condition.Equal,
            value: {
              kind: {
                oneofKind: "numberValue",
                numberValue: ObjectType_Layout.spaceView,
              },
            },
          }),
        ],
        // keys: ["targetSpaceId", "name", "spaceLocalStatus"],
      }),
      { meta: { token: this.token } },
    );
    if (response.status.code !== "OK") {
      throw response.response.error;
    }
    return response.response;
  }

  async getTypes(spaceId: string) {
    this.checkToken();
    // SmartBlockType.Page
    const response = await this.clientCommands.objectSearch(
      Rpc_Object_Search_Request.create({
        spaceId: spaceId,
        filters: [
          Block_Content_Dataview_Filter.create({
            relationKey: "resolvedLayout",
            condition: Block_Content_Dataview_Filter_Condition.Equal,
            value: {
              kind: {
                oneofKind: "numberValue",
                numberValue: ObjectType_Layout.objectType,
              },
            },
          }),
          // Block_Content_Dataview_Filter.create({
          //   relationKey: "spaceId",
          //   condition: Block_Content_Dataview_Filter_Condition.Equal,
          //   value: {
          //     kind: {
          //       oneofKind: "stringValue",
          //       stringValue: spaceId,
          //     },
          //   },
          // }),
          // Block_Content_Dataview_Filter.create({
          //   relationKey: "isHidden",
          //   condition: Block_Content_Dataview_Filter_Condition.Equal,
          //   value: {
          //     kind: {
          //       oneofKind: "boolValue",
          //       boolValue: false,
          //     },
          //   },
          // }),
          // Block_Content_Dataview_Filter.create({
          //   relationKey: "smartblockTypes",
          //   condition: Block_Content_Dataview_Filter_Condition.AllIn,
          //   value: {
          //     kind: {
          //       oneofKind: "listValue",
          //       listValue: {
          //         values: [
          //           {
          //             kind: {
          //               oneofKind: "numberValue",
          //               numberValue: SmartBlockType.Page,
          //             },
          //           },
          //         ],
          //       },
          //     },
          //   },
          // }),
        ],
        // keys: ["name", "spaceLocalStatus"],
      }),
      { meta: { token: this.token } },
    );
    if (response.status.code !== "OK") {
      throw response.response.error;
    }
    return response.response;
  }

  async getAll(spaceId: string) {
    this.checkToken();
    const response = await this.clientCommands.objectSearch(
      Rpc_Object_Search_Request.create({
        spaceId: spaceId,
        filters: [],
      }),
      { meta: { token: this.token } },
    );
    if (response.status.code !== "OK") {
      throw response.response.error;
    }
    return response.response;
  }

  async getDashboard(spaceId: string) {
    this.checkToken();
    let response = await this.clientCommands.objectSearch(
      Rpc_Object_Search_Request.create({
        spaceId: spaceId,
        filters: [
          Block_Content_Dataview_Filter.create({
            relationKey: "uniqueKey",
            condition: Block_Content_Dataview_Filter_Condition.Equal,
            value: {
              kind: {
                oneofKind: "stringValue",
                stringValue: "ot-dashboard",
              },
            },
          }),
        ],
      }),
      { meta: { token: this.token } },
    );

    let dashboardTypeId =
      response.response.records[0].fields.id.kind.stringValue;

    response = await this.clientCommands.objectSearch(
      Rpc_Object_Search_Request.create({
        spaceId: spaceId,
        filters: [
          Block_Content_Dataview_Filter.create({
            relationKey: "type",
            condition: Block_Content_Dataview_Filter_Condition.Equal,
            value: {
              kind: {
                oneofKind: "stringValue",
                stringValue: dashboardTypeId,
              },
            },
          }),
        ],
      }),
      { meta: { token: this.token } },
    );

    if (
      response.response.records[0].fields.links.kind.oneofKind !== "listValue"
    )
      return;

    const listOfLinks = response.response.records[0].fields.links;
    console.log("links", listOfLinks);
    console.log(
      "meow",
      response.response.records[0].fields.id.kind.stringValue,
    );

    // This is how you actually do this...
    const object = await this.clientCommands.objectOpen(
      Rpc_Object_Open_Request.create({
        objectId: response.response.records[0].fields.id.kind.stringValue,
      }),
      { meta: { token: this.token } },
    );

    await this.clientCommands.objectClose(
      Rpc_Object_Open_Request.create({
        objectId: response.response.records[0].fields.id.kind.stringValue,
      }),
      { meta: { token: this.token } },
    );

    if (!object.response.objectView?.blocks) {
      return;
    }

    if (!object.response.objectView?.details) {
      return;
    }

    // Convert list of blocks to a map.
    const blockMap: { [key: string]: Block } = {};
    for (const block of object.response.objectView?.blocks) {
      blockMap[block.id] = block;
    }

    // Convert list of details to a map.
    const detailMap: { [key: string]: ObjectView_DetailsSet } = {};
    for (const detail of object.response.objectView?.details) {
      detailMap[detail.id] = detail;
    }

    // Start at the root.
    const rootId = object.response.objectView.rootId;
    const root = blockMap[rootId];
    // All the links in the dashboard have a wrapper.
    // Not sure if this is necessary in the future,
    // but I'm just going to ditch the wrapper.
    const wrapperBlocks = root.childrenIds.map((id) => blockMap[id]);
    const linkBlocks = wrapperBlocks.map(
      (wrapperBlock) => blockMap[wrapperBlock.childrenIds[0]],
    );
    const links = linkBlocks
      .map((linkBlock) => {
        if (linkBlock.content.oneofKind !== "link") {
          return;
        }
        return linkBlock.content.link.targetBlockId;
      })
      .filter((linkBlock) => linkBlock !== undefined)
      .map((linkBlockId) => detailMap[linkBlockId]);

    return links;
  }

  async getOneObject(objectId: string) {
    let object = await this.clientCommands.objectOpen(
      Rpc_Object_Open_Request.create({
        objectId: objectId,
      }),
      { meta: { token: this.token } },
    );

    if (object.response.error.code === 1) {
      await this.clientCommands.objectOpen(
        Rpc_Object_Open_Request.create({
          spaceId: this.techSpaceId,
          objectId: objectId,
        }),
        { meta: { token: this.token } },
      );

      await this.clientCommands.objectClose(
        Rpc_Object_Open_Request.create({
          spaceId: this.techSpaceId,
          objectId: objectId,
        }),
        { meta: { token: this.token } },
      );

      return object;
    }

    await this.clientCommands.objectClose(
      Rpc_Object_Open_Request.create({
        objectId: objectId,
      }),
      { meta: { token: this.token } },
    );

    return object;
  }

  async getObjectsFromList(spaceId: string, listOfLinks: any) {
    const response = await this.clientCommands.objectSearch(
      Rpc_Object_Search_Request.create({
        spaceId: spaceId,
        filters: [
          Block_Content_Dataview_Filter.create({
            relationKey: "id",
            condition: Block_Content_Dataview_Filter_Condition.In,
            value: listOfLinks,
          }),
        ],
        sorts: [
          Block_Content_Dataview_Sort.create({
            customOrder: [],
          }),
        ],
      }),
      { meta: { token: this.token } },
    );
  }

  async getSpaceIcon(spaceId: string) {
    let response = await this.clientCommands.objectSearch(
      Rpc_Object_Search_Request.create({
        spaceId: spaceId,
        filters: [
          Block_Content_Dataview_Filter.create({
            relationKey: "uniqueKey",
            condition: Block_Content_Dataview_Filter_Condition.Equal,
            value: {
              kind: {
                oneofKind: "stringValue",
                stringValue: "ot-image",
              },
            },
          }),
        ],
      }),
      { meta: { token: this.token } },
    );

    let imageTypeId = response.response.records[0].fields.id.kind.stringValue;
    console.log(imageTypeId);

    const object = await this.clientCommands.objectSearch(
      Rpc_Object_Search_Request.create({
        spaceId: spaceId,
        filters: [
          Block_Content_Dataview_Filter.create({
            relationKey: "type",
            condition: Block_Content_Dataview_Filter_Condition.Equal,
            value: {
              kind: {
                oneofKind: "stringValue",
                stringValue: imageTypeId,
              },
            },
          }),
        ],
      }),
      { meta: { token: this.token } },
    );

    const file = await this.clientCommands.fileDownload(
      Rpc_File_Download_Request.create({
        objectId: object.response.records[0].fields.id.kind.stringValue,
        path: this.files,
        // path: "../"
        // path: object.response.records[0].fields.fileVariantPaths.kind.listValue
        //   .values[0].kind.stringValue,
      }),
      { meta: { token: this.token } },
    );
    console.log("file dl");
    console.log(file);
    return file;

    //ot-image
    //Images: bafyreihkrinznmo2x2b7m4xcekspxxzl6hav7zjzjdfiawirkztpqx2t7i
  }
}
