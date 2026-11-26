const EXPLAIN = {
'motor-seal-in': {
  how: ['<code>Start_PB OR Motor_Run</code> turns the motor on while Start is pressed, and keeps it on afterwards because the output feeds back into itself. This is the seal-in.', 'Each <code>AND NOT</code> condition after that can break the seal. They sit outside the OR, so Stop and Overload win even while Start is held.', 'It all fits in one assignment because a seal-in is just Boolean algebra.'],
  pitfalls: ['Writing it as an IF/ELSIF that checks Start first, which lets Start beat Stop.', 'Putting Stop inside the OR, as in <code>(Start_PB OR Motor_Run AND NOT Stop_PB)</code>. AND binds tighter than OR, so Start would bypass Stop.']
},
'part-counter': {
  how: ['A rising edge means "TRUE now, FALSE last scan", so compare <code>Part_Sensor</code> with <code>Sensor_Prev</code>.', 'Reset comes first in the IF chain, so while it is held nothing is counted.', 'Copy the sensor into <code>Sensor_Prev</code> on the last line, after it has been used. Next scan it holds this scan\'s value.'],
  pitfalls: ['Updating <code>Sensor_Prev</code> before the comparison, so the edge is never seen.', 'Counting on <code>Part_Sensor</code> alone, which adds one every scan the part blocks the eye.', 'Putting the <code>Sensor_Prev</code> update inside the IF, so it stops tracking while Reset is held.']
},
'toggle': {
  how: ['Detect the rising edge of the button, the same pattern as the part counter.', 'On that one scan only, flip the light with <code>Light := NOT Light;</code>.', 'Store the button state at the end for next scan.'],
  pitfalls: ['Toggling on <code>Toggle_PB</code> directly, which flips the light every scan the button is held.', 'Using two IFs (set if off, clear if on) in the same scan. The second one undoes the first.']
},
'analog-scaling': {
  how: ['Check the fault range first. If the signal is bad, set the fault and leave <code>Pressure_PSI</code> alone so it holds its last good value.', 'Otherwise scale linearly: subtract the raw zero (4000), multiply by the span (150), divide by the raw span (16000).', 'Using <code>150.0</code> instead of <code>150</code> makes the expression REAL, so the fraction is kept. Then clamp to 0–150.'],
  pitfalls: ['All-integer math, <code>(Raw - 4000) * 150 / 16000</code>, truncates. 4100 counts would give 0 instead of 0.9375.', 'Writing Pressure on the fault path as well, which loses the hold-last-good behaviour.']
},
'array-max': {
  how: ['Seed the answer with element 0: <code>Max_Value := Data[0]; Max_Index := 0;</code>.', 'Loop from 1 to 9 and replace the answer whenever an element is strictly greater.', 'Strictly greater (<code>&gt;</code>) means a later tie never replaces the first occurrence.'],
  pitfalls: ['Starting <code>Max_Value</code> at 0. With all-negative data, 0 wins and the answer is wrong.', 'Using <code>&gt;=</code>, which reports the last occurrence instead of the first.', 'Looping <code>TO 8</code> and missing the last element.']
},
'bit-count': {
  how: ['<code>Status_Word.[i]</code> reads bit i as a BOOL. This is Rockwell\'s indirect bit syntax.', 'Loop over all 32 bits and add one to <code>Bits_On</code> for each that is set.', 'Looping from 31 down to 0 means the last bit you record is the lowest one, so you can overwrite <code>Lowest_Bit</code> freely.'],
  pitfalls: ['Treating a negative DINT as having no bits. Bit 31 is the sign bit, so -1 has all 32 set.', 'Looping 0 TO 31 and overwriting <code>Lowest_Bit</code> each time, which gives the highest bit. Either loop down or only set it while it is still -1.']
},
'debounce': {
  how: ['The timer only needs to run while the input disagrees with the output, so <code>TimerEnable := Raw_Input &lt;&gt; Clean_Output</code>.', 'If the input flickers back, the enable drops, TONR resets ACC, and the 300 ms starts over.', 'When DN, copy the input to the output. Next scan they agree, the enable drops, and the timer resets itself, ready for the next change in either direction.'],
  pitfalls: ['<code>TimerEnable := Raw_Input</code> only debounces the rising edge. The output drops instantly when the switch opens.', 'Forgetting to call <code>TONR(Deb_Tmr);</code>. Setting members does nothing until the instruction runs.']
},
'hi-alarm': {
  how: ['The delay is a TONR enabled by <code>Temp_PV &gt; Alarm_SP</code>. Any dip to or below the setpoint resets it.', 'Timer done sets the alarm. Falling below <code>SP − Deadband</code> clears it.', 'The IF/ELSIF gives set priority, and between the two thresholds neither branch runs, so the alarm holds. That gap is the hysteresis.'],
  pitfalls: ['<code>Hi_Alarm := Alm_Tmr.DN;</code> clears the alarm the moment temperature dips below SP, so there is no deadband.', 'Clearing at <code>Temp_PV &lt; Alarm_SP</code> instead of <code>Alarm_SP − Deadband</code>.']
},
'moving-average': {
  how: ['Write each new sample at <code>Write_Idx</code>, then advance it with <code>(Write_Idx + 1) MOD 5</code> so it wraps 4 → 0. That is the ring buffer.', '<code>Count</code> rises to 5 and stays there. Before the buffer fills, slots 0…Count−1 are the valid ones.', 'Sum the first Count slots and divide by Count. REAL division, because Sum is REAL.'],
  pitfalls: ['Dividing by 5 from the start, which gives 2.0 instead of 10.0 for a first sample of 10.', 'Forgetting to reset <code>Sum := 0.0</code> each scan, so it grows forever.', 'Shifting the whole array every scan. It works, but it is the slow approach the problem asks you to avoid.']
},
'bubble-sort': {
  how: ['Copy Data into Sorted first, so the input is untouched.', 'Each outer pass walks neighbours j and j+1 and swaps any pair out of order. After pass i, the largest i+1 values sit at the end.', 'So the inner loop can stop at <code>8 − i</code>. That also guarantees <code>j + 1</code> never goes past 9.'],
  pitfalls: ['Inner loop <code>TO 9</code> reads <code>Sorted[10]</code>, an out-of-range major fault (Type 4, Code 83).', 'A swap without a temp (<code>Sorted[j] := Sorted[j+1]; Sorted[j+1] := Sorted[j];</code>) copies one value over the other.']
},
'traffic-light': {
  how: ['<code>Step</code> is the state. CASE runs only the current step\'s branch, and each branch sets its time and checks for its exit condition.', 'One timer serves every step. It is restarted whenever Step changes: <code>TimerEnable := (Step &lt;&gt; 0) AND (Step = Last_Step)</code> is FALSE for exactly one scan after a transition, which resets ACC.', 'Lamps are written once, from Step, after the CASE. Each lamp has a single assignment, so two can never be on together.'],
  pitfalls: ['Never resetting the timer between steps. DN stays TRUE and the sequence races through every step in consecutive scans.', 'Setting lamps inside the CASE branches and forgetting to turn the previous lamp off.']
},
'ramp-soak': {
  how: ['Disabled: track <code>PV_Temp</code>, so enabling starts from the furnace\'s actual temperature with no bump.', 'Enabled: step size = rate (°C/min) × scan time (ms) ÷ 60000. This is how far the setpoint may move in one scan.', 'Add (or subtract) the step, then check whether it went past the target, and if so set it equal to the target. Logix ST has no MIN/MAX, so this IF is how you clamp. Done is an exact comparison, which works because the clamp lands exactly on the target.'],
  pitfalls: ['Adding the step without clamping, so the setpoint overshoots and oscillates around the target.', 'Integer math in the step size (<code>/ 60000</code>), which rounds small steps to 0, so the ramp never moves.']
},
'lead-lag': {
  how: ['Each call is a hysteresis latch: set at the high level, clear at the low level, and between the two leave it alone.', 'Alternation happens on the falling edge of the lead call: <code>Level &lt;= 30 AND Lead_Call</code> is TRUE for exactly one scan, then the call is cleared.', 'A final IF maps the calls onto the pumps according to <code>Lead_Is_Pump2</code>.'],
  pitfalls: ['Toggling on <code>Level &lt;= 30</code> alone, which flips the lead every scan the well is low.', 'Writing <code>Lead_Call := Level &gt;= 70;</code>, which drops the pump as soon as the level falls below 70. There is no hysteresis.']
},
'first-out': {
  how: ['Ack resets <code>First_Out</code> to −1 before anything else.', 'Each alarm gets its own edge detection, using the matching slot in <code>Alarm_Prev</code>. An edge is recorded only while <code>First_Out = -1</code>, and the ascending loop makes the lowest index win same-scan ties.', 'Updating <code>Alarm_Prev[i]</code> every scan means an alarm that is still active after Ack never shows a new edge until it clears and trips again.'],
  pitfalls: ['Capturing on <code>Alarm_In[i]</code> instead of its rising edge, so a standing alarm grabs First_Out again straight after Ack.', 'Updating <code>Alarm_Prev</code> only inside the IF, so it goes stale.']
},
'permissive-chain': {
  how: ['An IF/ELSIF chain checks permissives in priority order and stops at the first failure. That is exactly "first missing".', 'The ELSE branch means all are healthy, so the code is 0.', 'The run output reuses the code: <code>Run_Cmd AND Not_Ready_Code = 0</code>.'],
  pitfalls: ['Separate IFs for each permissive, where a later one overwrites the code, so you report the last missing instead of the first.']
},
'tank-volume': {
  how: ['Copy the level and pull it back inside 0…height with IF/ELSIF. Logix ST has no LIMIT function.', 'Volume of a cylinder is π r² h. With r = D/2 and m³ × 1000 = litres.', 'Percent full is the clamped level over the height, × 100.'],
  pitfalls: ['Computing the volume from the unclamped level, which gives negative litres or over 100 %.']
},
'array-stats': {
  how: ['First loop: total the ten readings, then average = total ÷ 10.0.', 'Second loop: count readings strictly greater than the average. You cannot do it in one pass, because the average is not known until the end.'],
  pitfalls: ['Not resetting <code>Total</code> and <code>Above_Avg</code> at the start of every scan. Values persist between scans, so they double on the second scan.']
},
'lane-selector': {
  how: ['Clear all four valves first, then turn on at most one. Clear-then-set is the standard way to drive "one of N" outputs.', '<code>(Part_ID - 1) MOD 4</code> maps 1,2,3,4,5… to 0,1,2,3,0…, and adding 1 gives the lane number.', 'Index the valve array with <code>Lane - 1</code>.'],
  pitfalls: ['<code>Part_ID MOD 4</code> without the −1 puts part 4 in lane 0.', 'Not clearing the old valve, so several lanes end up open.']
},
'falling-edge': {
  how: ['A falling edge is "was TRUE, now FALSE": <code>Door_Prev AND NOT Door_Closed</code>.', 'Assign the pulse every scan, so it returns to FALSE on the next scan by itself.', '<code>Door_Prev</code> starts FALSE, so a door that is already open on the first scan is not an edge.'],
  pitfalls: ['Setting the pulse with IF and never clearing it.']
},
'peak-hold': {
  how: ['An <code>Initialized</code> flag replaces the controller\'s first-scan bit. Until it is set, or while Reset is held, both peaks take the current value.', 'After that, compare and replace: above the max is the new max, below the min is the new min.'],
  pitfalls: ['Relying on the default 0.0. Positive data would never pull the minimum up from 0, and negative data would never pull the maximum down.']
},
'hoa-mode': {
  how: ['Test "both contacts made" first, because that is the fault and it must win.', 'Then Hand, then Auto, else Off.', 'The pump is a single expression of Mode, so a fault (99) can never run it.'],
  pitfalls: ['Checking Hand first, so a broken switch with both contacts made reads as Hand and runs the pump.']
},
'valve-mismatch': {
  how: ['Error = feedback − command. <code>ABS</code> turns it into a magnitude, so one comparison covers both directions.', 'Exactly 2.0 is in tolerance (≤). Exactly 5.0 is not a mismatch (&gt;). Between them, both are FALSE.'],
  pitfalls: ['Comparing the signed error, so a valve stuck low never raises Mismatch.', 'Getting ≤ and &lt; the wrong way round at the boundaries.']
},
'linear-search': {
  how: ['Start with "not found" (−1) and a count of 0.', 'Scan all 20 elements. On a match, add one to the count, and record the index only if it is still −1, which keeps the first one.'],
  pitfalls: ['Using EXIT on the first match, which leaves Occurrences stuck at 1.', 'Recording the index on every match, which gives the last occurrence.']
},
'off-delay-fan': {
  how: ['TOFR is the off-delay instruction: DN is TRUE while enabled, and stays TRUE for PRE ms after the enable drops.', 'So the fan is simply <code>Fan_Tmr.DN</code>, with the heater as the enable.', 'If the heater comes back during cool-down, the enable rises again and DN never dropped, so the fan keeps running and the countdown restarts at the next off.'],
  pitfalls: ['Using TONR with <code>TimerEnable := NOT Heater_On</code> and <code>Fan_Run := NOT DN</code>. That runs the fan for 30 s at power-up even though the heater was never on.']
},
'staggered-start': {
  how: ['Start and Stop latch <code>Seq_Active</code>. Stop is checked first, so it wins.', 'One TONR with PRE 4000 runs while the sequence is active. Motor 2 compares ACC ≥ 2000, and Motor 3 uses DN.', 'Stopping disables the timer, which clears ACC, so the next start begins the stagger from zero.'],
  pitfalls: ['Starting all three motors from Start_PB directly, so they drop out when the button is released. Latch first.']
},
'run-hours': {
  how: ['Add the scan time to a DINT millisecond accumulator while running.', 'A WHILE loop moves every full 1000 ms into <code>Run_Seconds</code>, carrying any remainder. It also copes with scan times longer than 1 s.', 'Hours is a display conversion, seconds ÷ 3600.0. The start count is a plain rising edge.'],
  pitfalls: ['Accumulating hours directly in a REAL. A 32-bit REAL can no longer add 0.0000694 h once it reaches a few thousand, so the counter freezes.', '<code>Run_Seconds / 3600</code> as integer division, which shows 0 hours for the first hour.']
},
'rotate-array': {
  how: ['Rotated[i] comes from <code>Data[i + Shift]</code>, wrapped to 0…9.', 'In ST, MOD keeps the sign of the dividend, so −3 MOD 10 = −3.', '<code>((i + Shift) MOD 10 + 10) MOD 10</code> shifts the result into 0…19, then wraps it again, so it is always 0…9.'],
  pitfalls: ['A single MOD, which faults the controller with a negative index when Shift is negative.']
},
'bcd-convert': {
  how: ['Pull out each decimal digit with integer division and MOD: thousands = V / 1000, hundreds = (V / 100) MOD 10, and so on.', 'Each digit goes in its own nibble, so multiply by 16³, 16², 16 and 1 (4096, 256, 16, 1) and add them up.', 'DINT division truncates, which is exactly what digit extraction needs.'],
  pitfalls: ['Multiplying digits by 1000/100/10, which just rebuilds the decimal number.', 'Skipping the range check. 10000 has five digits and overflows four nibbles.']
},
'checksum': {
  how: ['Start both accumulators at 0 every scan.', 'XOR on two DINTs is bitwise, so XOR-ing all bytes gives the XOR check.', 'Sum everything, then MOD 256 keeps the low byte, which is what an 8-bit checksum wraps to.'],
  pitfalls: ['Not resetting the accumulators, so the checksum keeps changing every scan.']
},
'tank-batch': {
  how: ['Stop is handled before the CASE, so it overrides every step.', 'Each step only checks its own exit condition. Mix uses a TONR enabled by <code>Step = 20</code>, so it resets on its own when the step is left.', 'Outputs come from Step after the CASE, and every output is FALSE in idle.'],
  pitfalls: ['Writing outputs inside the CASE branches, so a valve stays open after the step changes.', 'Leaving the mix timer enabled outside step 20, so DN is already TRUE on the next batch and mixing is skipped.']
},
'voting-2oo3': {
  how: ['Median of three: put A and B in order as Hi and Lo. If C is above Hi the median is Hi, if it is below Lo the median is Lo, otherwise it is C. Logix ST has no MIN/MAX, so it is done with IFs.', 'Count how many sensors are above the trip setpoint. Two or more trips the furnace, so one failed sensor can neither cause nor block a trip.', 'Deviation compares each sensor with the median using ABS.'],
  pitfalls: ['Averaging the three instead of taking the median. One sensor failing high drags the average.', 'Tripping on any single sensor (1oo3), which defeats the voting.']
},
'totalizer': {
  how: ['Apply the low-flow cutoff first, so noise around zero (and negative readings) adds nothing.', 'Integrate: each scan adds flow (gal/min) × scan time (ms) ÷ 60000 (ms/min) gallons.', 'Reset zeroes the total.'],
  pitfalls: ['Dividing by an integer 60000, which truncates the per-scan amount to 0.', 'Integrating the raw flow, so the total drifts down when the meter reads slightly negative.']
},
'rate-of-change': {
  how: ['Rate = change since last scan ÷ scan time, scaled to per minute: ΔPV × 60000 ÷ scan_ms.', 'On the first scan there is no previous value, so output 0 and set <code>Have_Prev</code>.', 'Store PV every scan, and alarm on the magnitude with ABS.'],
  pitfalls: ['No first-scan guard. The first rate is computed against 0.0, a huge false spike that trips the alarm at startup.']
},
'drum-sequencer': {
  how: ['One TONR with PRE = step time runs while Run is TRUE.', 'On DN, advance the step with MOD 6 so it wraps, and pulse <code>Reset</code> (set, call TONR, clear) so the next step starts timing straight away.', 'The output word is the table entry for the current step, and <code>Out_Word.0</code> to <code>.2</code> read its bits.'],
  pitfalls: ['Advancing on DN without resetting the timer. DN stays TRUE and the drum spins through a step every scan.']
},
'lift-position': {
  how: ['Work out intent first: want up if the error is &gt; 0.5, want down if it is &lt; −0.5, and only while enabled.', 'Then apply the limits: a move happens only if its own limit is not active. Moving away from a limit is still allowed.', 'Slow speed is "moving AND close". Limit fault is "wants to move into an active limit".'],
  pitfalls: ['Blocking both directions when any limit is active, which strands the lift on the limit.', 'Leaving the move on while in position, so the axis hunts back and forth.']
},
'fifo-queue': {
  how: ['Both buttons act on rising edges, and unload is processed before load.', 'Unload: take <code>Queue[0]</code>, shift slots 1–4 down by one, and decrease Count.', 'Load: write to <code>Queue[Count]</code>, the first empty slot, and increase Count. Full and Empty come from Count.'],
  pitfalls: ['Shifting with <code>Queue[i] := Queue[i - 1]</code> going the wrong way, which overwrites the data you are about to read.', 'Loading when Count = 5, which writes <code>Queue[5]</code> and faults the controller.']
},
'jam-detect': {
  how: ['The jam timer runs while the motor is on, but its enable drops for one scan on every prox rising edge. That resets ACC, so 2 s with no edge is a jam.', 'Stopping the motor also disables the timer, so every start begins fresh.', 'On DN, latch the fault and drop <code>Motor_Out</code> on that same scan. Only Reset clears the fault.'],
  pitfalls: ['Resetting on <code>Shaft_Prox</code> (level) instead of its edge. A pulley that stops with the flag in front of the prox looks alive forever.']
},
'pi-controller': {
  how: ['Auto: the integral grows by Ki × error × dt every scan, and is clamped to 0–100 with an IF/ELSIF. That clamp is the anti-windup.', 'CV = P term + integral, clamped to 0–100. In manual, CV is the operator value, clamped the same way.', 'Manual: CV follows the operator, and the integral is back-calculated as CV − Kp × error, so the first auto scan gives the same CV. That is bumpless transfer.'],
  pitfalls: ['Clamping only CV and not the integral. During a long saturation the integral winds up to thousands, and CV stays at 100 % long after the error reverses.', 'Leaving the integral at 0 in manual, so switching to auto jumps the valve.']
},
'recipe-dosing': {
  how: ['Idle (−1) waits for a Start rising edge, then begins ingredient 0 with Target = Recipe_SP[0].', 'While dosing, close the valve once the weight reaches Target − Preact (the product still falling from the valve lands after it shuts). Then advance, and add the next ingredient to the cumulative Target.', 'After ingredient 3, go back to −1 and set Done. The valves are driven from the active index at the end.'],
  pitfalls: ['Comparing weight against each ingredient\'s own setpoint. The scale reads cumulative weight, so the target must be cumulative too.', 'Starting on the Start level instead of its edge, so holding Start launches a new batch as soon as one finishes.']
},
'shift-register': {
  how: ['On each encoder rising edge, shift the whole track one place downstream, Track[i] := Track[i−1], looping from 11 down to 1.', 'Then load the camera result into Track[0]. The gate reads Track[8], 8 pitches later.', 'Count rejects when a TRUE lands in position 8 during a shift.'],
  pitfalls: ['Looping upwards (1 TO 11). Track[1] gets Track[0], then Track[2] gets the new Track[1], and so on, so one reject smears down the whole array in one shift.']
}
};
if (typeof module !== 'undefined') module.exports = EXPLAIN;
