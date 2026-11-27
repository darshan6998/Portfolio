(function () {
const NEW = [
// ---------------- 2026-11-26 ----------------
{
  id: 'pump-dry-run', title: 'Pump dry-run trip with reset hysteresis', diff: 'Medium', topics: ['Interlocks', 'Timers', 'Hysteresis'],
  desc: `<p>A transfer pump on a process skid must not run dry. While the pump is running, if suction pressure <code>Suction_PSI</code> stays <b>below 5.0 psi for 3 s</b>, latch <code>Dry_Run_Trip</code>, stop the pump and add 1 to <code>Trip_Count</code>. A dip that recovers before 3 s must not trip, and the next dip starts timing from zero.</p>
<ul>
<li><code>Pump_Run</code> = <code>Run_Cmd</code> AND NOT <code>Dry_Run_Trip</code>.</li>
<li>Only time low suction while the pump is actually running. A stopped pump with no pressure is normal.</li>
<li><code>Reset_PB</code> clears the trip only when suction has recovered to <b>8.0 psi or more</b>. A reset at 6 psi is refused. If <code>Run_Cmd</code> is still on, the pump restarts right away.</li>
<li>Each trip counts once in <code>Trip_Count</code>.</li>
</ul>
<p class="note">Scan time is 250 ms.</p>`,
  tags: [
    { name: 'Run_Cmd', type: 'BOOL', dir: 'in', d: 'From the sequence' },
    { name: 'Suction_PSI', type: 'REAL', dir: 'in', d: 'Suction pressure' },
    { name: 'Reset_PB', type: 'BOOL', dir: 'in', d: 'Operator reset' },
    { name: 'Pump_Run', type: 'BOOL', dir: 'out', d: 'Starter output' },
    { name: 'Dry_Run_Trip', type: 'BOOL', dir: 'out', d: 'Latched trip' },
    { name: 'Trip_Count', type: 'DINT', dir: 'out', d: 'Trips since power-up' },
    { name: 'Low_Tmr', type: 'FBD_TIMER', dir: 'int', d: 'TONR, 3 s' }],
  starter: `Low_Tmr.PRE := 3000;\n\nPump_Run := Run_Cmd AND NOT Dry_Run_Trip;\n`,
  hints: ['Enable the TONR with Run_Cmd AND NOT Dry_Run_Trip AND Suction_PSI &lt; 5.0. A TONR resets the moment its enable drops, so a dip that recovers starts over.', 'The reset needs two conditions: Reset_PB AND Suction_PSI &gt;= 8.0. The gap between 5 and 8 psi is the hysteresis.'],
  solution: `IF Reset_PB AND Suction_PSI >= 8.0 THEN\n  Dry_Run_Trip := 0;\nEND_IF;\n\nLow_Tmr.PRE := 3000;\nLow_Tmr.TimerEnable := Run_Cmd AND NOT Dry_Run_Trip AND Suction_PSI < 5.0;\nTONR(Low_Tmr);\n\nIF Low_Tmr.DN THEN\n  Dry_Run_Trip := 1;\n  Trip_Count := Trip_Count + 1;\nEND_IF;\n\nPump_Run := Run_Cmd AND NOT Dry_Run_Trip;\n`,
  tests: [
    { name: 'Runs dry, reset refused, then reset', dt: 250, steps: [[4, { Run_Cmd: true, Suction_PSI: 20.0 }], [6, { Suction_PSI: 3.0 }], [10, {}], [4, { Reset_PB: true }], [4, { Reset_PB: false, Suction_PSI: 10.0 }], [4, { Reset_PB: true }], [4, { Reset_PB: false }]] },
    { name: 'Short dips, reset at 6 psi, stopped pump', hidden: true, dt: 250, steps: [[4, { Run_Cmd: true, Suction_PSI: 20.0 }], [8, { Suction_PSI: 4.0 }], [4, { Suction_PSI: 12.0 }], [8, { Suction_PSI: 4.0 }], [4, { Suction_PSI: 12.0 }], [16, { Suction_PSI: 2.0 }], [4, { Suction_PSI: 6.0, Reset_PB: true }], [4, { Reset_PB: false }], [4, { Suction_PSI: 9.0, Reset_PB: true }], [4, { Reset_PB: false, Run_Cmd: false, Suction_PSI: 0.0 }], [16, {}], [4, { Run_Cmd: true }], [16, {}]] }]
},
{
  id: 'modbus-crc16', title: 'Modbus RTU CRC-16', diff: 'Hard', topics: ['Bitwise', 'Serial comms', 'Nested loops'],
  desc: `<p>A VFD on a Modbus RTU serial link sends frames that end in a 16-bit CRC. Check it. The frame bytes are in <code>Msg[0..15]</code> (each 0–255), and <code>Msg_Len</code> says how many of them are real. Bytes past <code>Msg_Len</code> are left over from older frames, so ignore them.</p>
<p>The Modbus CRC-16 algorithm:</p>
<ol>
<li>Start with <code>CRC</code> = 16#FFFF.</li>
<li>For each byte: <code>CRC := CRC XOR byte</code>. Then repeat 8 times: if bit 0 of CRC is 1, shift CRC right one bit and XOR it with 16#A001; otherwise just shift it right one bit.</li>
</ol>
<p>Modbus sends the CRC <b>low byte first</b>. Set <code>CRC_Lo</code> = CRC AND 16#FF and <code>CRC_Hi</code> = the upper byte. <code>CRC_OK</code> is TRUE when they match the received <code>Rx_CRC_Lo</code> and <code>Rx_CRC_Hi</code>.</p>
<p>If <code>Msg_Len</code> is outside 1–16, set <code>Len_Fault</code> and leave <code>CRC</code>, <code>CRC_Lo</code> and <code>CRC_Hi</code> at 0, with <code>CRC_OK</code> FALSE.</p>
<p class="note">Logix ST has no shift operator. Shifting right by one bit is the same as dividing by 2 for these positive values. Example: the request 01 03 00 00 00 0A has CRC 16#CDC5, sent as C5 then CD.</p>`,
  tags: [
    { name: 'Msg', type: 'DINT', dim: 16, dir: 'in', d: 'ARRAY[0..15], bytes' },
    { name: 'Msg_Len', type: 'DINT', dir: 'in', d: 'Bytes in use, 1–16' },
    { name: 'Rx_CRC_Lo', type: 'DINT', dir: 'in', d: 'Received CRC, first byte' },
    { name: 'Rx_CRC_Hi', type: 'DINT', dir: 'in', d: 'Received CRC, second byte' },
    { name: 'CRC', type: 'DINT', dir: 'out', d: '0–65535' },
    { name: 'CRC_Lo', type: 'DINT', dir: 'out', d: '' },
    { name: 'CRC_Hi', type: 'DINT', dir: 'out', d: '' },
    { name: 'CRC_OK', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Len_Fault', type: 'BOOL', dir: 'out', d: '' },
    { name: 'i', type: 'DINT', dir: 'int', d: 'Byte index' },
    { name: 'b', type: 'DINT', dir: 'int', d: 'Bit counter' }],
  starter: `Len_Fault := (Msg_Len < 1) OR (Msg_Len > 16);\nCRC := 0;\nCRC_Lo := 0;\nCRC_Hi := 0;\nCRC_OK := 0;\n`,
  hints: ['Two nested FOR loops: bytes 0 TO Msg_Len − 1 outside, 1 TO 8 bit shifts inside. Test bit 0 with <code>CRC.0</code> before you shift.', 'The low byte is CRC AND 16#FF and the high byte is CRC / 256. Compare Lo with Rx_CRC_Lo, because Modbus sends it first.'],
  solution: `Len_Fault := (Msg_Len < 1) OR (Msg_Len > 16);\nCRC := 0;\nCRC_Lo := 0;\nCRC_Hi := 0;\nCRC_OK := 0;\n\nIF NOT Len_Fault THEN\n  CRC := 16#FFFF;\n  FOR i := 0 TO Msg_Len - 1 DO\n    CRC := CRC XOR Msg[i];\n    FOR b := 1 TO 8 DO\n      IF CRC.0 THEN\n        CRC := ((CRC - 1) / 2) XOR 16#A001;\n      ELSE\n        CRC := CRC / 2;\n      END_IF;\n    END_FOR;\n  END_FOR;\n  CRC_Lo := CRC AND 16#FF;\n  CRC_Hi := CRC / 256;\n  CRC_OK := (CRC_Lo = Rx_CRC_Lo) AND (CRC_Hi = Rx_CRC_Hi);\nEND_IF;\n`,
  tests: [
    { name: 'Read-registers request', steps: [[1, { Msg: [1, 3, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], Msg_Len: 6, Rx_CRC_Lo: 197, Rx_CRC_Hi: 205 }], [1, { Rx_CRC_Lo: 205, Rx_CRC_Hi: 197 }]] },
    { name: 'Leftover bytes, full frame, bad length', hidden: true, steps: [[1, { Msg: [1, 3, 0, 0, 0, 1, 99, 99, 99, 99, 255, 255, 255, 255, 255, 255], Msg_Len: 6, Rx_CRC_Lo: 132, Rx_CRC_Hi: 10 }], [1, { Msg: [17, 16, 0, 1, 0, 2, 4, 0, 10, 1, 2, 255, 128, 127, 1, 254], Msg_Len: 16 }], [1, { Msg_Len: 0 }], [1, { Msg_Len: 17 }], [1, { Msg: [255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], Msg_Len: 1 }]] }]
}];
PROBLEMS.push(...NEW);
})();
