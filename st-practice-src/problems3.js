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
},
// ---------------- 2026-11-27 ----------------
{
  id: 'alarm-ack', title: 'Alarm acknowledge states (ISA-18.2)', diff: 'Medium', topics: ['Alarms', 'Edge detection', 'Timers'],
  desc: `<p>A high-level switch on a quench tank drives an alarm on the HMI. Build the alarm logic with proper acknowledge handling.</p>
<ul>
<li><code>Alarm_Active</code> turns on once <code>Alarm_Cond</code> has been TRUE for <b>2 s without a break</b>, and turns off as soon as <code>Alarm_Cond</code> goes FALSE. A blip shorter than 2 s never alarms, and the next one times from zero.</li>
<li>Each time <code>Alarm_Active</code> turns on, set <code>Unacked</code>.</li>
<li>A <b>press</b> of <code>Ack_PB</code> (its rising edge) clears <code>Unacked</code>. Holding the button in does not acknowledge an alarm that comes in later; the operator has to press it again.</li>
<li>If the alarm clears before anyone acknowledges it, <code>Unacked</code> stays on until it is acknowledged.</li>
<li><code>Horn</code> = <code>Alarm_Active</code> AND <code>Unacked</code>.</li>
<li><code>Alarm_State</code> for the HMI: 0 = normal, 1 = active and unacknowledged, 2 = active and acknowledged, 3 = cleared but still unacknowledged.</li>
</ul>
<p class="note">Scan time is 100 ms.</p>`,
  tags: [
    { name: 'Alarm_Cond', type: 'BOOL', dir: 'in', d: 'High-level switch' },
    { name: 'Ack_PB', type: 'BOOL', dir: 'in', d: 'Operator acknowledge' },
    { name: 'Alarm_Active', type: 'BOOL', dir: 'out', d: 'After the 2 s delay' },
    { name: 'Unacked', type: 'BOOL', dir: 'out', d: 'Waiting for acknowledge' },
    { name: 'Horn', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Alarm_State', type: 'DINT', dir: 'out', d: '0 / 1 / 2 / 3' },
    { name: 'Delay_Tmr', type: 'FBD_TIMER', dir: 'int', d: 'TONR, 2 s' },
    { name: 'Active_Prev', type: 'BOOL', dir: 'int', d: 'Edge memory' },
    { name: 'Ack_Prev', type: 'BOOL', dir: 'int', d: 'Edge memory' }],
  starter: `Delay_Tmr.PRE := 2000;\nDelay_Tmr.TimerEnable := Alarm_Cond;\nTONR(Delay_Tmr);\nAlarm_Active := Delay_Tmr.DN;\n`,
  hints: ['Unacked is a latch: set it on the rising edge of Alarm_Active, clear it on the rising edge of Ack_PB. Keep a _Prev bit for each edge.', 'Build Alarm_State last with IF / ELSIF from Alarm_Active and Unacked. Four combinations, four states.'],
  solution: `Delay_Tmr.PRE := 2000;\nDelay_Tmr.TimerEnable := Alarm_Cond;\nTONR(Delay_Tmr);\nAlarm_Active := Delay_Tmr.DN;\n\n// new alarm: needs acknowledging\nIF Alarm_Active AND NOT Active_Prev THEN\n  Unacked := 1;\nEND_IF;\nActive_Prev := Alarm_Active;\n\n// acknowledge on the press, not the hold\nIF Ack_PB AND NOT Ack_Prev THEN\n  Unacked := 0;\nEND_IF;\nAck_Prev := Ack_PB;\n\nHorn := Alarm_Active AND Unacked;\n\nIF Alarm_Active AND Unacked THEN\n  Alarm_State := 1;\nELSIF Alarm_Active THEN\n  Alarm_State := 2;\nELSIF Unacked THEN\n  Alarm_State := 3;\nELSE\n  Alarm_State := 0;\nEND_IF;\n`,
  tests: [
    { name: 'Alarm, acknowledge, clear', dt: 100, steps: [[3, {}], [10, { Alarm_Cond: true }], [15, {}], [1, { Ack_PB: true }], [5, { Ack_PB: false }], [5, { Alarm_Cond: false }]] },
    { name: 'Clears before acknowledge', dt: 100, steps: [[25, { Alarm_Cond: true }], [5, { Alarm_Cond: false }], [1, { Ack_PB: true }], [5, { Ack_PB: false }]] },
    { name: 'Blips, held ack, re-alarm', hidden: true, dt: 100, steps: [[10, { Alarm_Cond: true }], [4, { Alarm_Cond: false }], [15, { Alarm_Cond: true }], [5, { Alarm_Cond: false }], [1, { Ack_PB: true }], [25, { Alarm_Cond: true }], [5, {}], [1, { Ack_PB: false }], [1, { Ack_PB: true }], [5, { Ack_PB: false }], [5, { Alarm_Cond: false }], [25, { Alarm_Cond: true }], [5, { Alarm_Cond: false }], [5, {}]] }]
},
{
  id: 'burner-lightoff', title: 'Burner light-off sequence with lockout', diff: 'Hard', topics: ['CASE', 'Sequencing', 'Interlocks', 'Timers'],
  desc: `<p>A gas burner on a heat-treat furnace lights off in steps. Write the burner management sequence as a <code>CASE</code> on <code>Step</code>.</p>
<div class="scroll"><table class="tt"><tr><th>Step</th><th>Name</th><th>Outputs on</th><th>Leaves when</th></tr>
<tr><td>0</td><td>Idle</td><td>none</td><td>a <b>press</b> of <code>Start_PB</code> (rising edge) with no flame seen → 10. Holding Start in must not restart the burner.</td></tr>
<tr><td>10</td><td>Purge</td><td>Blower</td><td><code>Flame_Detected</code> (a flame before ignition is a fault) → 99. Otherwise after <b>5 s of purge with <code>Air_Flow_OK</code></b> → 20. If air flow drops, the purge starts again from zero.</td></tr>
<tr><td>20</td><td>Pilot trial</td><td>Blower, Igniter, Pilot</td><td>air flow lost → 99. After <b>3 s</b>: flame seen → 30, no flame → 99.</td></tr>
<tr><td>30</td><td>Run</td><td>Blower, Pilot, Main</td><td>flame lost or air flow lost → 99.</td></tr>
<tr><td>99</td><td>Lockout</td><td>Blower, <code>Lockout</code></td><td><code>Reset_PB</code> while <b>no flame is seen</b> → 0. A flame signal during reset means a stuck scanner, so the reset is refused.</td></tr></table></div>
<ul>
<li><code>Stop_PB</code> sends any step back to 0, <b>except lockout</b>. Only a reset clears a lockout.</li>
<li>Each step's timer starts from zero when the step is entered.</li>
<li>Outputs: <code>Blower_On</code>, <code>Igniter_On</code>, <code>Pilot_Valve</code>, <code>Main_Valve</code>, <code>Lockout</code>, driven from <code>Step</code> as in the table.</li>
</ul>
<p class="note">Scan time is 250 ms.</p>`,
  tags: [
    { name: 'Start_PB', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Stop_PB', type: 'BOOL', dir: 'in', d: 'TRUE = stop' },
    { name: 'Air_Flow_OK', type: 'BOOL', dir: 'in', d: 'Combustion air switch' },
    { name: 'Flame_Detected', type: 'BOOL', dir: 'in', d: 'Flame scanner' },
    { name: 'Reset_PB', type: 'BOOL', dir: 'in', d: 'Lockout reset' },
    { name: 'Step', type: 'DINT', dir: 'out', d: '0 / 10 / 20 / 30 / 99' },
    { name: 'Blower_On', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Igniter_On', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Pilot_Valve', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Main_Valve', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Lockout', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Step_Tmr', type: 'FBD_TIMER', dir: 'int', d: 'TONR, step timer' },
    { name: 'Last_Step', type: 'DINT', dir: 'int', d: 'Step on the last scan' },
    { name: 'Start_Prev', type: 'BOOL', dir: 'int', d: 'Edge memory' },
    { name: 'Start_Edge', type: 'BOOL', dir: 'int', d: 'One-scan pulse' }],
  starter: `Start_Edge := Start_PB AND NOT Start_Prev;\nStart_Prev := Start_PB;\n\nCASE Step OF\n  0:\n    // idle\n  10:\n    // purge\nEND_CASE;\n`,
  hints: ['Run the step timer only when the step did not change since last scan (Step = Last_Step). That drops the enable for one scan on every change, which resets the TONR. In purge, also AND in Air_Flow_OK.', 'In step 20 the timer decides, and the flame picks where to go: IF Step_Tmr.DN THEN IF Flame_Detected THEN 30 ELSE 99. Put the Stop check after the CASE with Step &lt;&gt; 99.'],
  solution: `Start_Edge := Start_PB AND NOT Start_Prev;\nStart_Prev := Start_PB;\n\n// step timer: restarts on every step change\nIF Step = 10 THEN\n  Step_Tmr.PRE := 5000;\nELSE\n  Step_Tmr.PRE := 3000;\nEND_IF;\nStep_Tmr.TimerEnable := (Step = Last_Step) AND ((Step = 10 AND Air_Flow_OK) OR Step = 20);\nTONR(Step_Tmr);\nLast_Step := Step;\n\nCASE Step OF\n  0: // idle\n    IF Start_Edge AND NOT Flame_Detected THEN Step := 10; END_IF;\n  10: // purge\n    IF Flame_Detected THEN\n      Step := 99;\n    ELSIF Step_Tmr.DN THEN\n      Step := 20;\n    END_IF;\n  20: // pilot trial for ignition\n    IF NOT Air_Flow_OK THEN\n      Step := 99;\n    ELSIF Step_Tmr.DN THEN\n      IF Flame_Detected THEN Step := 30; ELSE Step := 99; END_IF;\n    END_IF;\n  30: // run\n    IF NOT Flame_Detected OR NOT Air_Flow_OK THEN Step := 99; END_IF;\n  99: // lockout\n    IF Reset_PB AND NOT Flame_Detected THEN Step := 0; END_IF;\nEND_CASE;\n\nIF Stop_PB AND Step <> 99 THEN\n  Step := 0;\nEND_IF;\n\nBlower_On   := Step = 10 OR Step = 20 OR Step = 30 OR Step = 99;\nIgniter_On  := Step = 20;\nPilot_Valve := Step = 20 OR Step = 30;\nMain_Valve  := Step = 30;\nLockout     := Step = 99;\n`,
  tests: [
    { name: 'Normal light-off and stop', dt: 250, steps: [[2, { Air_Flow_OK: true }], [1, { Start_PB: true }], [10, { Start_PB: false }], [16, {}], [1, { Flame_Detected: true }], [13, {}], [10, {}], [1, { Stop_PB: true }], [4, { Stop_PB: false, Flame_Detected: false }]] },
    { name: 'No flame on trial, then reset', dt: 250, steps: [[2, { Air_Flow_OK: true }], [1, { Start_PB: true }], [26, { Start_PB: false }], [20, {}], [4, { Reset_PB: true }], [4, { Reset_PB: false }]] },
    { name: 'Air loss in purge, flame failure, stuck scanner, held Start', hidden: true, dt: 250, steps: [[2, { Air_Flow_OK: true }], [1, { Start_PB: true }], [15, {}], [4, { Air_Flow_OK: false }], [14, { Air_Flow_OK: true }], [14, {}], [1, { Flame_Detected: true }], [20, {}], [5, { Flame_Detected: false }], [4, { Stop_PB: true }], [4, { Stop_PB: false, Flame_Detected: true, Reset_PB: true }], [4, { Flame_Detected: false }], [4, { Reset_PB: false }], [8, {}], [1, { Start_PB: false }], [1, { Start_PB: true }], [5, { Flame_Detected: true }], [4, { Start_PB: false }]] }]
}];

PROBLEMS.push(...NEW);
})();
