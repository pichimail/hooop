import fs from 'node:fs/promises';
const origin=new URL('../src/machine/profiles.json',import.meta.url);
export const builtins=(await fs.readFile(origin,'utf8'));
export const machineProfiles=JSON.parse(builtins).machines.map(p=>({
  ...p,protocol:p.link==='skitch'?'skitch':null,
  connection:p.link==='skitch'?'direct-ble':p.format?'file-export':'profile-only',
  direct_control:p.link==='skitch',
  transfer_methods:p.link==='skitch'?['ble-skitch','usb-file']:p.format?['usb-file','configured-lan-http']:[],
  monitored:p.link==='skitch',
  certified:p.tested===true,
  max_stitch_count:null,
  compatibility_note:p.link==='skitch'?'PP1 BLE implementation exists; requires physical pairing.':'Format/hoop profile only; no vendor-specific direct protocol available.'
}));
export function findProfile(id){return machineProfiles.find(x=>x.id===id)}
