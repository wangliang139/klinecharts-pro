import arrow from './arrow'

import circle from './circle'
import rect from './rect'
import parallelogram from './parallelogram'
import triangle from './triangle'
import fibonacciCircle from './fibonacciCircle'
import fibonacciSegment from './fibonacciSegment'
import fibonacciSpiral from './fibonacciSpiral'
import fibonacciSpeedResistanceFan from './fibonacciSpeedResistanceFan'
import fibonacciExtension from './fibonacciExtension'
import gannBox from './gannBox'
import threeWaves from './threeWaves'
import fiveWaves from './fiveWaves'
import eightWaves from './eightWaves'
import anyWaves from './anyWaves'
import abcd from './abcd'
import xabcd from './xabcd'

import brush from './brush'
import positionAvgLine from './trading/positionAvgLine'
import liquidationLine from './trading/liquidationLine'
import pendingOrderLine from './trading/pendingOrderLine'
import hisOrderMark from './trading/hisOrderMark'

const overlays = [
  arrow(), brush(),
  circle(), rect(), triangle(), parallelogram(),
  fibonacciCircle(), fibonacciSegment(), fibonacciSpiral(),
  fibonacciSpeedResistanceFan(), fibonacciExtension(), gannBox(),
  threeWaves(), fiveWaves(), eightWaves(), anyWaves(), abcd(), xabcd(),
  positionAvgLine(),
  liquidationLine(),
  pendingOrderLine(),
  hisOrderMark(),
]

export default overlays
