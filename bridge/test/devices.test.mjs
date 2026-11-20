import test from 'node:test';import assert from 'node:assert/strict';import {dnsQuery,decodeMdns,deviceId,volumeRoots} from '../devices.mjs';import {machineProfiles} from '../profiles.mjs';
test('DNS discovery queries require no machine control and are well formed',()=>{
 const q=dnsQuery('_embroidery._tcp.local');assert.equal(q.readUInt16BE(4),1);assert.equal(q.readUInt16BE(q.length-4),12);assert.equal(q.readUInt16BE(q.length-2),1);
 assert.deepEqual(decodeMdns(Buffer.alloc(5)),[]);assert.deepEqual(decodeMdns(Buffer.alloc(12)),[]);
});
test('Machine profiles do not fake unsupported direct connections',()=>{
 assert.ok(machineProfiles.length>=9);assert.equal(machineProfiles.filter(p=>p.direct_control).length,1);
 assert.equal(machineProfiles.find(p=>p.id==='brother-skitch').protocol,'skitch');assert.equal(machineProfiles.find(p=>p.id==='janome-550e').protocol,null);
 assert.equal(machineProfiles.find(p=>p.id==='commercial-dst').connection,'file-export');
});
test('USB and BLE discovery IDs are stable, volume locations platform-scoped',()=>{
 assert.equal(deviceId('volume','/a'),deviceId('volume','/a'));assert.notEqual(deviceId('volume','/a'),deviceId('volume','/b'));
 assert.deepEqual(volumeRoots('darwin'),['/Volumes']);assert.ok(volumeRoots('win32').some(x=>x.startsWith('D:')));
});
