// `fake-indexeddb/auto` is a side-effect entry that installs the IndexedDB
// globals; it ships no type declaration for that subpath, so importing it is an
// implicit `any` under `noImplicitAny`. It has no API surface to describe —
// declaring the module empty is the whole contract.
declare module 'fake-indexeddb/auto';
