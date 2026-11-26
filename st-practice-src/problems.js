const PROBLEMS = [
{
  id: 'motor-seal-in', title: 'Motor start/stop seal-in', diff: 'Easy', topics: ['Boolean logic', 'Latching'],
  desc: `<p>Write the classic three-wire motor control. Pressing <code>Start_PB</code> starts the motor, and it keeps running after the button is released.</p>
<p>Pressing <code>Stop_PB</code> or an <code>Overload_Trip</code> stops it. Stop and overload always win, even if Start is held at the same time.</p>
<p class="note">Both push-buttons read TRUE while pressed. (In the field, Stop is usually wired normally-closed. The input here has already been inverted for you.)</p>`,
  tags: [
    { name: 'Start_PB', type: 'BOOL', dir: 'in', d: 'TRUE while Start is pressed' },
    { name: 'Stop_PB', type: 'BOOL', dir: 'in', d: 'TRUE while Stop is pressed' },
    { name: 'Overload_Trip', type: 'BOOL', dir: 'in', d: 'TRUE when the overload relay has tripped' },
    { name: 'Motor_Run', type: 'BOOL', dir: 'out', d: 'Motor contactor output' }],
  starter: `// Motor_Run should seal itself in.\n\nMotor_Run := ;\n`,
  hints: ['A seal-in is just OR-ing the output with itself: (Start OR Motor_Run).', 'Put the stop conditions in series with AND NOT so they always win.'],
  solution: `Motor_Run := (Start_PB OR Motor_Run)\n             AND NOT Stop_PB\n             AND NOT Overload_Trip;\n`,
  tests: [
    { name: 'Start, release, stop', steps: [[1, {}], [1, { Start_PB: true }], [3, { Start_PB: false }], [1, { Stop_PB: true }], [2, { Stop_PB: false }]] },
    { name: 'Stop beats Start', steps: [[1, { Start_PB: true, Stop_PB: true }], [1, { Stop_PB: false }], [1, { Start_PB: false }]] },
    { name: 'Overload trip', hidden: true, steps: [[1, { Start_PB: true }], [2, { Start_PB: false }], [1, { Overload_Trip: true }], [1, { Start_PB: true }], [1, { Overload_Trip: false, Start_PB: false }], [1, { Start_PB: true }], [1, { Start_PB: false }]] }]
},
{
  id: 'part-counter', title: 'Rising-edge part counter', diff: 'Easy', topics: ['Edge detection', 'Counters'],
  desc: `<p>A photo-eye on a conveyor turns <code>Part_Sensor</code> TRUE while a part is in front of it. A part can block the sensor for many scans.</p>
<p>Count each part <b>once</b>, on the rising edge of the sensor. While <code>Reset_Count</code> is TRUE, hold <code>Part_Count</code> at 0 and ignore the sensor.</p>`,
  tags: [
    { name: 'Part_Sensor', type: 'BOOL', dir: 'in', d: 'Photo-eye, TRUE while blocked' },
    { name: 'Reset_Count', type: 'BOOL', dir: 'in', d: 'Clears the count' },
    { name: 'Part_Count', type: 'DINT', dir: 'out', d: 'Number of parts counted' },
    { name: 'Sensor_Prev', type: 'BOOL', dir: 'int', d: 'Storage bit for edge detection' }],
  starter: `IF Reset_Count THEN\n  \nEND_IF;\n`,
  hints: ['A rising edge is "TRUE now AND it was FALSE last scan".', 'Update Sensor_Prev at the end of the routine, after you have used it.'],
  solution: `IF Reset_Count THEN\n  Part_Count := 0;\nELSIF Part_Sensor AND NOT Sensor_Prev THEN\n  Part_Count := Part_Count + 1;\nEND_IF;\n\nSensor_Prev := Part_Sensor;\n`,
  tests: [
    { name: 'Two parts, one held', steps: [[1, {}], [3, { Part_Sensor: true }], [1, { Part_Sensor: false }], [1, { Part_Sensor: true }], [1, { Part_Sensor: false }]] },
    { name: 'Reset while parts pass', steps: [[1, { Part_Sensor: true }], [1, { Part_Sensor: false }], [1, { Part_Sensor: true }], [1, { Part_Sensor: false }], [1, { Reset_Count: true }], [1, { Part_Sensor: true }], [1, { Part_Sensor: false, Reset_Count: false }], [1, { Part_Sensor: true }], [1, { Part_Sensor: false }]] },
    { name: 'Sensor held through reset release', hidden: true, steps: [[1, { Reset_Count: true, Part_Sensor: true }], [2, { Reset_Count: false }], [1, { Part_Sensor: false }], [1, { Part_Sensor: true }], [5, { Part_Sensor: false }]] }]
},
{
  id: 'toggle', title: 'Push-on / push-off toggle', diff: 'Easy', topics: ['Edge detection', 'Flip-flop'],
  desc: `<p>One push-button controls a light. Each press toggles <code>Light</code>: the first press turns it on and the next turns it off. Holding the button must not make it flicker.</p>`,
  tags: [
    { name: 'Toggle_PB', type: 'BOOL', dir: 'in', d: 'TRUE while pressed' },
    { name: 'Light', type: 'BOOL', dir: 'out', d: 'Light output' },
    { name: 'PB_Prev', type: 'BOOL', dir: 'int', d: 'Storage bit' }],
  starter: `// Toggle Light once per press\n`,
  hints: ['Detect the rising edge first, then invert Light only on that scan.', 'Light := NOT Light; flips a BOOL.'],
  solution: `IF Toggle_PB AND NOT PB_Prev THEN\n  Light := NOT Light;\nEND_IF;\nPB_Prev := Toggle_PB;\n`,
  tests: [
    { name: 'Press, release, press', steps: [[1, {}], [1, { Toggle_PB: true }], [2, { Toggle_PB: false }], [1, { Toggle_PB: true }], [1, { Toggle_PB: false }]] },
    { name: 'Long hold', hidden: true, steps: [[10, { Toggle_PB: true }], [1, { Toggle_PB: false }], [4, { Toggle_PB: true }], [1, { Toggle_PB: false }], [1, { Toggle_PB: true }]] }]
},
{
  id: 'analog-scaling', title: '4–20 mA pressure scaling', diff: 'Easy', topics: ['REAL math', 'Scaling', 'Clamping'],
  desc: `<p>A pressure transmitter reads 0–150 PSI as 4–20 mA. The analog card reports this in <code>Raw_Counts</code>, where 4000 counts is 4 mA and 20000 counts is 20 mA.</p>
<ul><li>Scale linearly into <code>Pressure_PSI</code>, clamped to 0.0–150.0.</li>
<li>If <code>Raw_Counts</code> is below 3600 or above 21000, the signal is bad. Set <code>Sensor_Fault</code> and <b>hold the last good</b> <code>Pressure_PSI</code>.</li>
<li>Otherwise clear <code>Sensor_Fault</code>.</li></ul>`,
  tags: [
    { name: 'Raw_Counts', type: 'DINT', dir: 'in', d: '4000 = 4 mA, 20000 = 20 mA' },
    { name: 'Pressure_PSI', type: 'REAL', dir: 'out', d: 'Scaled pressure, 0.0–150.0' },
    { name: 'Sensor_Fault', type: 'BOOL', dir: 'out', d: 'Under/over range' }],
  starter: `// EU = (Raw - RawMin) * (EUMax - EUMin) / (RawMax - RawMin) + EUMin\n`,
  hints: ['If every operand is a DINT, the division is integer division and the fraction is lost. Use a REAL literal such as 150.0.', 'Only write Pressure_PSI on the good-signal path, so it holds when the signal is faulted.'],
  solution: `IF Raw_Counts < 3600 OR Raw_Counts > 21000 THEN\n  Sensor_Fault := 1;\nELSE\n  Sensor_Fault := 0;\n  Pressure_PSI := (Raw_Counts - 4000) * 150.0 / 16000.0;\n  IF Pressure_PSI < 0.0 THEN\n    Pressure_PSI := 0.0;\n  ELSIF Pressure_PSI > 150.0 THEN\n    Pressure_PSI := 150.0;\n  END_IF;\nEND_IF;\n`,
  tests: [
    { name: 'Span points', steps: [[1, { Raw_Counts: 4000 }], [1, { Raw_Counts: 12000 }], [1, { Raw_Counts: 20000 }], [1, { Raw_Counts: 4100 }]] },
    { name: 'Clamp and fault hold', steps: [[1, { Raw_Counts: 3800 }], [1, { Raw_Counts: 20500 }], [1, { Raw_Counts: 3000 }], [1, { Raw_Counts: 12345 }]] },
    { name: 'Over-range hold', hidden: true, steps: [[1, { Raw_Counts: 9999 }], [1, { Raw_Counts: 25000 }], [1, { Raw_Counts: 21000 }], [1, { Raw_Counts: 3599 }], [1, { Raw_Counts: 3600 }]] }]
},
{
  id: 'array-max', title: 'Find the maximum in an array', diff: 'Easy', topics: ['Arrays', 'FOR loops'],
  desc: `<p>Find the largest value in <code>Data[0..9]</code> and write it to <code>Max_Value</code>. Write its position to <code>Max_Index</code>. If the largest value appears more than once, report the <b>first</b> index.</p>`,
  tags: [
    { name: 'Data', type: 'DINT', dim: 10, dir: 'in', d: 'ARRAY[0..9] OF DINT' },
    { name: 'Max_Value', type: 'DINT', dir: 'out', d: 'Largest element' },
    { name: 'Max_Index', type: 'DINT', dir: 'out', d: 'Index of first largest element' },
    { name: 'i', type: 'DINT', dir: 'int', d: 'Loop index' }],
  starter: `FOR i := 0 TO 9 DO\n  \nEND_FOR;\n`,
  hints: ['Seed Max_Value with Data[0], not 0. The data might be all negative.', 'Use > rather than >= to keep the first occurrence.'],
  solution: `Max_Value := Data[0];\nMax_Index := 0;\nFOR i := 1 TO 9 DO\n  IF Data[i] > Max_Value THEN\n    Max_Value := Data[i];\n    Max_Index := i;\n  END_IF;\nEND_FOR;\n`,
  tests: [
    { name: 'Mixed values', steps: [[1, { Data: [3, 17, 4, 9, 2, 11, 0, 8, 6, 5] }]] },
    { name: 'All negative', steps: [[1, { Data: [-40, -12, -99, -7, -50, -8, -30, -61, -15, -22] }]] },
    { name: 'Duplicates and last slot', hidden: true, steps: [[1, { Data: [5, 9, 1, 9, 3, 9, 2, 0, 4, 7] }], [1, { Data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 100] }]] }]
},
{
  id: 'bit-count', title: 'Count bits in a status word', diff: 'Medium', topics: ['Bit access', 'FOR loops'],
  desc: `<p>A drive reports 32 status flags packed into <code>Status_Word</code>. Set <code>Bits_On</code> to the number of bits that are 1.</p>
<p>Set <code>Lowest_Bit</code> to the number of the lowest bit that is set, or −1 if no bit is set. Remember that bit 31 is the sign bit of a DINT.</p>
<p class="note">Rockwell indirect bit syntax: <code>Status_Word.[i]</code>.</p>`,
  tags: [
    { name: 'Status_Word', type: 'DINT', dir: 'in', d: '32 packed flags' },
    { name: 'Bits_On', type: 'DINT', dir: 'out', d: 'Count of 1 bits' },
    { name: 'Lowest_Bit', type: 'DINT', dir: 'out', d: 'Lowest set bit, or -1' },
    { name: 'i', type: 'DINT', dir: 'int', d: 'Loop index' }],
  starter: `Bits_On := 0;\nLowest_Bit := -1;\n`,
  hints: ['Loop i from 0 to 31 and test Status_Word.[i].', 'Looping downward (31 TO 0 BY -1) lets you overwrite Lowest_Bit without an extra flag. You can also use EXIT.'],
  solution: `Bits_On := 0;\nLowest_Bit := -1;\nFOR i := 31 TO 0 BY -1 DO\n  IF Status_Word.[i] THEN\n    Bits_On := Bits_On + 1;\n    Lowest_Bit := i;\n  END_IF;\nEND_FOR;\n`,
  tests: [
    { name: 'Small words', steps: [[1, { Status_Word: 0 }], [1, { Status_Word: 1 }], [1, { Status_Word: 240 }], [1, { Status_Word: 0b10100000 }]] },
    { name: 'Sign bit', hidden: true, steps: [[1, { Status_Word: -2147483648 }], [1, { Status_Word: -1 }], [1, { Status_Word: 0x55555554 }]] }]
},
{
  id: 'debounce', title: 'Input debounce with TONR', diff: 'Medium', topics: ['Timers', 'Filtering'],
  desc: `<p>A limit switch chatters. <code>Clean_Output</code> should change to match <code>Raw_Input</code> only after the input has stayed at the new state for <b>300 ms</b> without a break. This applies to both rising and falling changes.</p>
<p>Use the <code>Deb_Tmr</code> FBD_TIMER with <code>TONR</code>. The scan time is 50 ms.</p>`,
  tags: [
    { name: 'Raw_Input', type: 'BOOL', dir: 'in', d: 'Bouncy switch' },
    { name: 'Clean_Output', type: 'BOOL', dir: 'out', d: 'Debounced state' },
    { name: 'Deb_Tmr', type: 'FBD_TIMER', dir: 'int', d: 'TONR timer' }],
  starter: `Deb_Tmr.PRE := 300;\nDeb_Tmr.TimerEnable := ;\nTONR(Deb_Tmr);\n`,
  hints: ['Time only while the input disagrees with the output.', 'When the timer is done, copy the input to the output. The timer then disables and resets on its own.'],
  solution: `Deb_Tmr.PRE := 300;\nDeb_Tmr.TimerEnable := Raw_Input <> Clean_Output;\nTONR(Deb_Tmr);\n\nIF Deb_Tmr.DN THEN\n  Clean_Output := Raw_Input;\nEND_IF;\n`,
  tests: [
    { name: 'Bounce, then settle on', dt: 50, steps: [[2, {}], [3, { Raw_Input: true }], [2, { Raw_Input: false }], [4, { Raw_Input: true }], [6, {}]] },
    { name: 'Settle off', dt: 50, steps: [[12, { Raw_Input: true }], [2, { Raw_Input: false }], [1, { Raw_Input: true }], [3, { Raw_Input: false }], [6, {}]] },
    { name: 'Rapid chatter never passes', hidden: true, dt: 50, steps: [[2, { Raw_Input: true }], [2, { Raw_Input: false }], [2, { Raw_Input: true }], [2, { Raw_Input: false }], [3, { Raw_Input: true }], [2, { Raw_Input: false }]] }]
},
{
  id: 'hi-alarm', title: 'High-temp alarm with delay and deadband', diff: 'Medium', topics: ['Timers', 'Hysteresis', 'Alarms'],
  desc: `<p>Raise <code>Hi_Alarm</code> when <code>Temp_PV</code> has been above <code>Alarm_SP</code> for <b>2 s</b> continuously. If the temperature dips back to or below the setpoint, the delay starts over.</p>
<p>Once raised, the alarm stays on until <code>Temp_PV</code> drops below <code>Alarm_SP − Deadband</code>. It then clears immediately.</p>
<p>Scan time is 250 ms. Use <code>Alm_Tmr</code>.</p>`,
  tags: [
    { name: 'Temp_PV', type: 'REAL', dir: 'in', d: 'Measured temperature, °C' },
    { name: 'Alarm_SP', type: 'REAL', dir: 'in', d: 'Alarm setpoint, °C' },
    { name: 'Deadband', type: 'REAL', dir: 'in', d: 'Clear deadband, °C' },
    { name: 'Hi_Alarm', type: 'BOOL', dir: 'out', d: 'Alarm output' },
    { name: 'Alm_Tmr', type: 'FBD_TIMER', dir: 'int', d: 'Delay-on timer' }],
  starter: `Alm_Tmr.PRE := 2000;\n`,
  hints: ['The timer enable is simply Temp_PV > Alarm_SP.', 'Set the alarm from the timer and clear it from the deadband check. Use IF/ELSIF so that neither branch fights the other.'],
  solution: `Alm_Tmr.PRE := 2000;\nAlm_Tmr.TimerEnable := Temp_PV > Alarm_SP;\nTONR(Alm_Tmr);\n\nIF Alm_Tmr.DN THEN\n  Hi_Alarm := 1;\nELSIF Temp_PV < Alarm_SP - Deadband THEN\n  Hi_Alarm := 0;\nEND_IF;\n`,
  tests: [
    { name: 'Short excursion, then real alarm', dt: 250, steps: [[2, { Temp_PV: 1490.0, Alarm_SP: 1500.0, Deadband: 10.0 }], [5, { Temp_PV: 1505.0 }], [2, { Temp_PV: 1495.0 }], [4, { Temp_PV: 1506.0 }], [6, {}]] },
    { name: 'Deadband hold and clear', dt: 250, steps: [[12, { Temp_PV: 1520.0, Alarm_SP: 1500.0, Deadband: 10.0 }], [4, { Temp_PV: 1495.0 }], [1, { Temp_PV: 1490.5 }], [1, { Temp_PV: 1489.0 }], [3, { Temp_PV: 1495.0 }]] },
    { name: 'Setpoint moved', hidden: true, dt: 250, steps: [[12, { Temp_PV: 800.0, Alarm_SP: 790.0, Deadband: 5.0 }], [2, { Alarm_SP: 850.0 }], [12, { Temp_PV: 900.0 }], [2, { Temp_PV: 846.0 }], [1, { Temp_PV: 844.0 }]] }]
},
{
  id: 'moving-average', title: 'Moving average (ring buffer)', diff: 'Medium', topics: ['Arrays', 'MOD', 'Filtering'],
  desc: `<p>Every scan, store <code>New_Sample</code> and output <code>Avg_Out</code>: the average of the <b>last 5 samples</b>, including this one.</p>
<p>Until 5 samples have been collected, average only the samples you have so far. Use <code>Buffer</code> as a ring buffer rather than shifting the whole array.</p>`,
  tags: [
    { name: 'New_Sample', type: 'REAL', dir: 'in', d: 'Sample this scan' },
    { name: 'Avg_Out', type: 'REAL', dir: 'out', d: 'Average of last ≤5 samples' },
    { name: 'Buffer', type: 'REAL', dim: 5, dir: 'int', d: 'ARRAY[0..4] OF REAL' },
    { name: 'Write_Idx', type: 'DINT', dir: 'int', d: 'Next slot to write' },
    { name: 'Count', type: 'DINT', dir: 'int', d: 'Samples collected (max 5)' },
    { name: 'Sum', type: 'REAL', dir: 'int', d: 'Scratch' },
    { name: 'i', type: 'DINT', dir: 'int', d: 'Loop index' }],
  starter: `Buffer[Write_Idx] := New_Sample;\n`,
  hints: ['Write_Idx := (Write_Idx + 1) MOD 5; wraps the index.', 'Before the buffer fills, slots 0..Count-1 hold the valid samples.'],
  solution: `Buffer[Write_Idx] := New_Sample;\nWrite_Idx := (Write_Idx + 1) MOD 5;\nIF Count < 5 THEN\n  Count := Count + 1;\nEND_IF;\n\nSum := 0.0;\nFOR i := 0 TO Count - 1 DO\n  Sum := Sum + Buffer[i];\nEND_FOR;\nAvg_Out := Sum / Count;\n`,
  tests: [
    { name: 'Filling up', steps: [[1, { New_Sample: 10.0 }], [1, { New_Sample: 20.0 }], [1, { New_Sample: 30.0 }], [1, { New_Sample: 40.0 }], [1, { New_Sample: 50.0 }], [1, { New_Sample: 60.0 }], [1, { New_Sample: 70.0 }]] },
    { name: 'Wraps many times', hidden: true, steps: [[1, { New_Sample: 1.5 }], [1, { New_Sample: -2.0 }], [7, { New_Sample: 4.0 }], [1, { New_Sample: 100.0 }], [1, { New_Sample: 0.0 }], [3, { New_Sample: 2.25 }]] }]
},
{
  id: 'bubble-sort', title: 'Sort an array ascending', diff: 'Medium', topics: ['Arrays', 'Nested loops'],
  desc: `<p>Copy <code>Data[0..9]</code> into <code>Sorted[0..9]</code> and sort <code>Sorted</code> in ascending order. Leave <code>Data</code> unchanged.</p>
<p>Any sorting algorithm is fine. Watch your loop bounds: reading <code>Sorted[10]</code> faults the controller.</p>`,
  tags: [
    { name: 'Data', type: 'DINT', dim: 10, dir: 'in', d: 'ARRAY[0..9] OF DINT' },
    { name: 'Sorted', type: 'DINT', dim: 10, dir: 'out', d: 'ARRAY[0..9] OF DINT' },
    { name: 'i', type: 'DINT', dir: 'int', d: 'Loop index' },
    { name: 'j', type: 'DINT', dir: 'int', d: 'Loop index' },
    { name: 'Temp', type: 'DINT', dir: 'int', d: 'Swap scratch' }],
  starter: `FOR i := 0 TO 9 DO\n  Sorted[i] := Data[i];\nEND_FOR;\n\n// sort Sorted[] here\n`,
  hints: ['Bubble sort: compare neighbours j and j+1 and swap them if they are out of order.', 'The inner loop must stop at 8 − i, so that j+1 never reaches 10.'],
  solution: `FOR i := 0 TO 9 DO\n  Sorted[i] := Data[i];\nEND_FOR;\n\nFOR i := 0 TO 8 DO\n  FOR j := 0 TO 8 - i DO\n    IF Sorted[j] > Sorted[j + 1] THEN\n      Temp := Sorted[j];\n      Sorted[j] := Sorted[j + 1];\n      Sorted[j + 1] := Temp;\n    END_IF;\n  END_FOR;\nEND_FOR;\n`,
  tests: [
    { name: 'Random order', steps: [[1, { Data: [42, 7, 19, 3, 88, 21, 5, 64, 13, 30] }]] },
    { name: 'Reversed', steps: [[1, { Data: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0] }]] },
    { name: 'Negatives and duplicates', hidden: true, steps: [[1, { Data: [0, -5, 12, -5, 7, 7, -100, 3, 12, 1] }], [1, { Data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }]] }]
},
{
  id: 'traffic-light', title: 'Traffic light state machine', diff: 'Hard', topics: ['CASE', 'State machines', 'Timers'],
  desc: `<p>Build a sequencer with <code>CASE</code>. <code>Step</code> must report the state: 0 = off, 10 = red (4 s), 20 = green (5 s), 30 = yellow (2 s). After yellow it goes back to red.</p>
<p>When <code>Enable</code> goes TRUE, start at red. When it goes FALSE, go to step 0 with every lamp off. Exactly one lamp is on in each running step.</p>
<p class="note">Scan time is 100 ms. Checks are taken mid-phase, so being one scan early or late at a transition is fine.</p>`,
  tags: [
    { name: 'Enable', type: 'BOOL', dir: 'in', d: 'Run the sequence' },
    { name: 'Step', type: 'DINT', dir: 'out', d: '0, 10, 20 or 30' },
    { name: 'Red_Lamp', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Yellow_Lamp', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Green_Lamp', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Step_Tmr', type: 'FBD_TIMER', dir: 'int', d: 'Step timer' },
    { name: 'Last_Step', type: 'DINT', dir: 'int', d: 'Step on the previous scan' }],
  starter: `CASE Step OF\n  0:\n    IF Enable THEN Step := 10; END_IF;\n  10: // red\n    \nEND_CASE;\n`,
  hints: ['Restart the step timer whenever Step changes. Comparing Step with Last_Step tells you a transition just happened.', 'Set the lamps from Step after the CASE, so each lamp has exactly one assignment.'],
  solution: `IF NOT Enable THEN\n  Step := 0;\nEND_IF;\n\nCASE Step OF\n  0:\n    IF Enable THEN Step := 10; END_IF;\n  10: // red\n    Step_Tmr.PRE := 4000;\n    IF Step_Tmr.DN THEN Step := 20; END_IF;\n  20: // green\n    Step_Tmr.PRE := 5000;\n    IF Step_Tmr.DN THEN Step := 30; END_IF;\n  30: // yellow\n    Step_Tmr.PRE := 2000;\n    IF Step_Tmr.DN THEN Step := 10; END_IF;\nEND_CASE;\n\n// restart the timer on every step change\nStep_Tmr.TimerEnable := (Step <> 0) AND (Step = Last_Step);\nLast_Step := Step;\nTONR(Step_Tmr);\n\nRed_Lamp    := Step = 10;\nGreen_Lamp  := Step = 20;\nYellow_Lamp := Step = 30;\n`,
  tests: [
    { name: 'One full cycle', dt: 100, steps: [[3, {}], [20, { Enable: true }], [45, {}], [35, {}], [30, {}], [45, {}]] },
    { name: 'Disable mid-green, restart', dt: 100, steps: [[60, { Enable: true }], [5, { Enable: false }], [3, { Enable: true }], [17, {}], [45, {}]] },
    { name: 'Disable during yellow', hidden: true, dt: 100, steps: [[100, { Enable: true }], [3, { Enable: false }], [3, { Enable: true }], [55, {}], [40, {}]] }]
},
{
  id: 'ramp-soak', title: 'Furnace setpoint ramp', diff: 'Hard', topics: ['REAL math', 'Rate limiting', 'Process'],
  desc: `<p>Furnace controllers never jump the setpoint straight to a new target. Drive <code>Working_SP</code> toward <code>Target_SP</code> at <code>Ramp_Rate</code> °C/min.</p>
<ul><li>While <code>Ramp_Enable</code> is FALSE, track the furnace for a bumpless start: set <code>Working_SP := PV_Temp</code> and clear <code>Ramp_Done</code>.</li>
<li>While it is TRUE, move <code>Working_SP</code> by <code>Ramp_Rate × Scan_Time_ms / 60000</code> each scan, up or down, and never past the target.</li>
<li><code>Ramp_Done</code> is TRUE when <code>Working_SP</code> equals <code>Target_SP</code>.</li></ul>`,
  tags: [
    { name: 'Ramp_Enable', type: 'BOOL', dir: 'in', d: 'Ramp active' },
    { name: 'PV_Temp', type: 'REAL', dir: 'in', d: 'Furnace temperature, °C' },
    { name: 'Target_SP', type: 'REAL', dir: 'in', d: 'Final setpoint, °C' },
    { name: 'Ramp_Rate', type: 'REAL', dir: 'in', d: '°C per minute' },
    { name: 'Scan_Time_ms', type: 'DINT', dir: 'in', d: 'Task period, ms' },
    { name: 'Working_SP', type: 'REAL', dir: 'out', d: 'Ramped setpoint' },
    { name: 'Ramp_Done', type: 'BOOL', dir: 'out', d: 'Reached target' },
    { name: 'Step_Size', type: 'REAL', dir: 'int', d: 'Scratch' }],
  starter: `IF NOT Ramp_Enable THEN\n  \nELSE\n  \nEND_IF;\n`,
  hints: ['Step_Size := Ramp_Rate * Scan_Time_ms / 60000.0;', 'Add the step, then IF it went past the target, set it equal to the target. Logix ST has no MIN/MAX functions, so clamping is done with IF.'],
  solution: `IF NOT Ramp_Enable THEN\n  Working_SP := PV_Temp;\n  Ramp_Done := 0;\nELSE\n  Step_Size := Ramp_Rate * Scan_Time_ms / 60000.0;\n  IF Working_SP < Target_SP THEN\n    Working_SP := Working_SP + Step_Size;\n    IF Working_SP > Target_SP THEN\n      Working_SP := Target_SP;\n    END_IF;\n  ELSIF Working_SP > Target_SP THEN\n    Working_SP := Working_SP - Step_Size;\n    IF Working_SP < Target_SP THEN\n      Working_SP := Target_SP;\n    END_IF;\n  END_IF;\n  Ramp_Done := Working_SP = Target_SP;\nEND_IF;\n`,
  tests: [
    { name: 'Ramp up 25 → 35 °C', steps: [[2, { PV_Temp: 25.0, Target_SP: 35.0, Ramp_Rate: 300.0, Scan_Time_ms: 100 }], [5, { Ramp_Enable: true }], [10, {}], [10, {}]] },
    { name: 'Retarget downward', steps: [[1, { PV_Temp: 1200.0, Target_SP: 1210.0, Ramp_Rate: 600.0, Scan_Time_ms: 100 }], [15, { Ramp_Enable: true }], [3, { Target_SP: 1205.0 }], [10, {}]] },
    { name: 'Disable mid-ramp, odd step size', hidden: true, steps: [[1, { PV_Temp: 500.0, Target_SP: 501.0, Ramp_Rate: 90.0, Scan_Time_ms: 250 }], [3, { Ramp_Enable: true }], [1, { Ramp_Enable: false, PV_Temp: 480.0 }], [1, { Ramp_Enable: true, Target_SP: 480.0 }], [2, {}]] }]
},
{
  id: 'lead-lag', title: 'Lead/lag pump alternation', diff: 'Hard', topics: ['Hysteresis', 'Alternation'],
  desc: `<p>Two pumps empty a wet well. The <b>lead</b> call turns on at <code>Wet_Well_Level</code> ≥ 70 % and off at ≤ 30 %. The <b>lag</b> call turns on at ≥ 85 % and off at ≤ 50 %.</p>
<p>Pump 1 starts as lead. Each time the lead call turns off, which is the end of a pump-down, swap the roles by toggling <code>Lead_Is_Pump2</code>. The lead pump follows the lead call and the other pump follows the lag call.</p>`,
  tags: [
    { name: 'Wet_Well_Level', type: 'REAL', dir: 'in', d: 'Level, %' },
    { name: 'Pump1_Run', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Pump2_Run', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Lead_Is_Pump2', type: 'BOOL', dir: 'out', d: 'FALSE = pump 1 leads' },
    { name: 'Lead_Call', type: 'BOOL', dir: 'int', d: '' },
    { name: 'Lag_Call', type: 'BOOL', dir: 'int', d: '' }],
  starter: `// lead call with hysteresis\n\n// lag call with hysteresis\n\n// map calls to pumps\n`,
  hints: ['Only toggle on the call\'s falling edge. Check Lead_Call AND level ≤ 30, then clear it.', 'Between the on and off levels, write nothing: the call simply holds.'],
  solution: `IF Wet_Well_Level >= 70.0 THEN\n  Lead_Call := 1;\nELSIF Wet_Well_Level <= 30.0 AND Lead_Call THEN\n  Lead_Call := 0;\n  Lead_Is_Pump2 := NOT Lead_Is_Pump2;\nEND_IF;\n\nIF Wet_Well_Level >= 85.0 THEN\n  Lag_Call := 1;\nELSIF Wet_Well_Level <= 50.0 THEN\n  Lag_Call := 0;\nEND_IF;\n\nIF Lead_Is_Pump2 THEN\n  Pump2_Run := Lead_Call;\n  Pump1_Run := Lag_Call;\nELSE\n  Pump1_Run := Lead_Call;\n  Pump2_Run := Lag_Call;\nEND_IF;\n`,
  tests: [
    { name: 'One pump-down then swap', steps: [[1, { Wet_Well_Level: 20.0 }], [1, { Wet_Well_Level: 50.0 }], [1, { Wet_Well_Level: 72.0 }], [1, { Wet_Well_Level: 60.0 }], [1, { Wet_Well_Level: 31.0 }], [1, { Wet_Well_Level: 30.0 }], [1, { Wet_Well_Level: 20.0 }], [1, { Wet_Well_Level: 75.0 }]] },
    { name: 'Lag assists', steps: [[1, { Wet_Well_Level: 75.0 }], [1, { Wet_Well_Level: 90.0 }], [1, { Wet_Well_Level: 60.0 }], [1, { Wet_Well_Level: 45.0 }], [1, { Wet_Well_Level: 25.0 }], [1, { Wet_Well_Level: 86.0 }], [1, { Wet_Well_Level: 50.0 }], [1, { Wet_Well_Level: 10.0 }]] },
    { name: 'No swap without a cycle', hidden: true, steps: [[1, { Wet_Well_Level: 10.0 }], [1, { Wet_Well_Level: 29.0 }], [1, { Wet_Well_Level: 69.9 }], [1, { Wet_Well_Level: 70.0 }], [1, { Wet_Well_Level: 69.0 }], [1, { Wet_Well_Level: 30.0 }], [1, { Wet_Well_Level: 30.0 }], [1, { Wet_Well_Level: 70.0 }], [1, { Wet_Well_Level: 0.0 }]] }]
},
{
  id: 'first-out', title: 'First-out alarm annunciator', diff: 'Hard', topics: ['Arrays', 'Edge detection', 'Alarms'],
  desc: `<p>A trip often sets off a cascade of alarms, and the operator needs to know which one came <b>first</b>. <code>First_Out</code> holds the index (0–7) of the first alarm in <code>Alarm_In</code> to go FALSE→TRUE since the last acknowledge, or −1 if there is none yet.</p>
<ul><li>If several alarms trip on the same scan, the lowest index wins.</li>
<li>While <code>Ack_PB</code> is TRUE, reset <code>First_Out</code> to −1. Alarms that are still active do not count again until they clear and re-trip.</li>
<li><code>Active_Count</code> is the number of alarms that are TRUE right now.</li></ul>`,
  tags: [
    { name: 'Alarm_In', type: 'BOOL', dim: 8, dir: 'in', d: 'ARRAY[0..7] OF BOOL' },
    { name: 'Ack_PB', type: 'BOOL', dir: 'in', d: 'Acknowledge' },
    { name: 'First_Out', type: 'DINT', dir: 'out', init: -1, d: 'Index or -1 (starts at -1)' },
    { name: 'Active_Count', type: 'DINT', dir: 'out', d: 'Alarms active now' },
    { name: 'Alarm_Prev', type: 'BOOL', dim: 8, dir: 'int', d: 'ARRAY[0..7] OF BOOL' },
    { name: 'i', type: 'DINT', dir: 'int', d: 'Loop index' }],
  starter: `IF Ack_PB THEN\n  First_Out := -1;\nEND_IF;\n\nFOR i := 0 TO 7 DO\n  \nEND_FOR;\n`,
  hints: ['Each alarm needs its own edge detection, so keep a matching Alarm_Prev array.', 'Capture an edge only while First_Out = -1. An ascending loop then gives the lowest index for free.'],
  solution: `IF Ack_PB THEN\n  First_Out := -1;\nEND_IF;\n\nActive_Count := 0;\nFOR i := 0 TO 7 DO\n  IF Alarm_In[i] THEN\n    Active_Count := Active_Count + 1;\n    IF NOT Alarm_Prev[i] AND First_Out = -1 THEN\n      First_Out := i;\n    END_IF;\n  END_IF;\n  Alarm_Prev[i] := Alarm_In[i];\nEND_FOR;\n`,
  tests: (() => { const A = s => s.split('').map(c => c === '1'); return [
    { name: 'Cascade and acknowledge', steps: [[1, { Alarm_In: A('00000000') }], [1, { Alarm_In: A('00010000') }], [1, { Alarm_In: A('01010000') }], [1, { Ack_PB: true }], [1, { Ack_PB: false }], [1, { Alarm_In: A('01010100') }]] },
    { name: 'Same-scan trips', steps: [[1, { Alarm_In: A('00100010') }], [1, { Alarm_In: A('00000000') }], [1, { Ack_PB: true }], [1, { Ack_PB: false }], [1, { Alarm_In: A('00000011') }]] },
    { name: 'Re-trip after clear', hidden: true, steps: [[1, { Alarm_In: A('10000000') }], [1, { Ack_PB: true }], [1, { Ack_PB: false }], [2, {}], [1, { Alarm_In: A('00000000') }], [1, { Alarm_In: A('10000001') }]] }]; })()
}];
if (typeof module !== 'undefined') module.exports = PROBLEMS;
