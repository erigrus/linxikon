// Keep progress across the rename. New entries win; legacy entries remain intact.
export const STORAGE_PREFIX = 'semantio:';
export const LEGACY_PREFIX = 'linxikon:';

export function migrateStorage(storage) {
  try {
    const store=storage??globalThis.localStorage;
    const keys=Array.from({length:store.length},(_,i)=>store.key(i)).filter(key=>key?.startsWith(LEGACY_PREFIX));
    for(const key of keys){
      const destination=STORAGE_PREFIX+key.slice(LEGACY_PREFIX.length);
      if(store.getItem(destination)===null){const value=store.getItem(key);if(value!==null)store.setItem(destination,value);}
    }
    return true;
  }catch{return false;}
}

export function readStorage(key,fallback,storage) {
  try {
    const store=storage??globalThis.localStorage;
    let raw=store.getItem(key);
    if(raw===null&&key.startsWith(STORAGE_PREFIX))raw=store.getItem(LEGACY_PREFIX+key.slice(STORAGE_PREFIX.length));
    return raw===null?fallback:JSON.parse(raw)??fallback;
  }catch{return fallback;}
}

export function writeStorage(key,value,storage) {
  try{(storage??globalThis.localStorage).setItem(key,JSON.stringify(value));return true;}
  catch{return false;}
}
