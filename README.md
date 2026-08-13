# AnyBuddy

Super-generalized TypeScript way of interacting with AnyType data and interacting with an AnyType service provider.

Found that developing ontop of AnyType feels super clunky and bloated for someone with two brain cells like me. The MCP and python API's went over my head like pla pla pla. Wanted an API that resembles simpler web technologies.

I think they were using protos to try to enforce some enterprise level standardization but I am a crazy person who drinks too much coffee and I don't want protos goddamnit.

# Start

Run the simple example.

`pn meep`

# Prereq

You need to download anytype-heart's [grpc_server](https://github.com/anyproto/anytype-heart/releases) binary first. I developed this on a mac so I only tested on a mac. Make a new folder named bin/ and stick it in there. Launch the grpc_server in the background.

I think Anytype themselves use a bash command to autodownload, I think I'm gonna make a "postinstall" script.

# Wishes

These are my wishes for AnyBuddy... AKA what I want it to be.

## Initialization

```sh
ANYHEART_GRPC=anyheart/grpc_server
```

```tsx
const anybuddy = new AnyBuddy(); // Default AnyType server.
const session = await anybuddy.login("long auth key here");
await anybuddy.connect(session);
```

## Listening to Events

```tsx
anybuddy.on("unknown-event", () => {
  // Oh no, should we error?
});

anybuddy.on("unhandled-event", () => {
  // Oh no, should we error?
});

anybuddy.on("login", () => {
  // Do something.
});

anybuddy.on("block-updated", () => {
  // Perhaps another person updated a block?
});
```

## Querying Anytype

```tsx
await anybuddy.updateBlock(...);
await anybuddy.requestBlock(...);
await anybuddy.updateType(...);
await anybuddy.requestType(...);
```

# Licensing

Idk... Nothing outside of src/proto/ is based on anything from AnyType. The only thing
from AnyType is the protobuf definitions.

No licensing yet. This work is incomplete.
