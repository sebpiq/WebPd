/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import * as subpatch from './nodes/subpatch'
import * as dacTilde from './nodes/dac~'
import * as adcTilde from './nodes/adc~'
import * as sampleRateTilde from './nodes/samplerate~'
import * as oscPhasorTilde from './nodes/osc~-phasor~'
import * as clipTilde from './nodes/clip~'
import * as sigTilde from './nodes/sig~'
import * as sampholdTilde from './nodes/samphold~'
import * as snapshotTilde from './nodes/snapshot~'
import * as vlineTilde from './nodes/vline~'
import * as lineTilde from './nodes/line~'
import * as line from './nodes/line'
import * as funcsTilde from './nodes/funcs~'
import * as tabread from './nodes/tabread'
import * as tabwrite from './nodes/tabwrite'
import * as tabwriteTilde from './nodes/tabwrite~'
import * as tabreadTilde from './nodes/tabread~-tabread4~'
import * as tabplayTilde from './nodes/tabplay~'
import * as readsfTilde from './nodes/readsf~'
import * as writesfTilde from './nodes/writesf~'
import * as bpTilde from './nodes/filters-bp~'
import * as throwCatchSendReceiveTilde from './nodes/throw~-catch~-send~-receive~'
import * as metro from './nodes/metro'
import * as timer from './nodes/timer'
import * as delay from './nodes/delay'
import * as controlsFloat from './nodes/controls-float'
import * as bang from './nodes/controls-bang'
import * as controlsAtoms from './nodes/controls-atoms'
import * as loadbang from './nodes/loadbang'
import * as floatAndInt from './nodes/float-int'
import * as funcs from './nodes/funcs'
import * as binopTilde from './nodes/binop~'
import * as noiseTilde from './nodes/noise~'
import * as delreadTilde from './nodes/delread~-delread4~'
import * as delwriteTilde from './nodes/delwrite~'
import * as filtersRealTilde from './nodes/filters-real~'
import * as filtersComplexTilde from './nodes/filters-complex~'
import * as filtersHipTilde from './nodes/filters-hip~'
import * as filtersLopTilde from './nodes/filters-lop~'
import * as filtersVcfTilde from './nodes/filters-vcf~'
import * as msg from './nodes/msg'
import * as list from './nodes/list'
import * as symbol from './nodes/symbol'
import * as sendReceive from './nodes/send-receive'
import * as soundfiler from './nodes/soundfiler'
import * as print from './nodes/print'
import * as trigger from './nodes/trigger'
import * as change from './nodes/change'
import * as moses from './nodes/moses'
import * as clip from './nodes/clip'
import * as route from './nodes/route'
import * as spigot from './nodes/spigot'
import * as until from './nodes/until'
import * as random from './nodes/random'
import * as pipe from './nodes/pipe'
import * as pack from './nodes/pack'
import * as unpack from './nodes/unpack'
import * as expr from './nodes/expr-expr~'
import * as binop from './nodes/binop'
import * as _implicitMsgSort from './nodes/_routemsg'
import * as _implicitMixerTilde from './nodes/_mixer~'
import { NodeImplementations } from '@webpd/compiler'
import { NodeBuilders } from '../compile-dsp-graph/types'

const NODE_BUILDERS: NodeBuilders = {
    ...subpatch.nodeBuilders,
    ...binopTilde.builders,
    ...funcsTilde.builders,
    ...oscPhasorTilde.builders,
    ...filtersRealTilde.builders,
    ...filtersComplexTilde.builders,
    ...delreadTilde.builders,
    ...throwCatchSendReceiveTilde.builders,
    ...sendReceive.builders,
    ...sendReceive.builders,
    ...tabreadTilde.builders,
    'noise~': noiseTilde.builder,
    'snapshot~': snapshotTilde.builder,
    'sig~': sigTilde.builder,
    'samphold~': sampholdTilde.builder,
    'clip~': clipTilde.builder,
    'vline~': vlineTilde.builder,
    'line~': lineTilde.builder,
    'dac~': dacTilde.builder,
    'adc~': adcTilde.builder,
    'samplerate~': sampleRateTilde.builder,
    'tabplay~': tabplayTilde.builder,
    'tabwrite~': tabwriteTilde.builder,
    'readsf~': readsfTilde.builder,
    'writesf~': writesfTilde.builder,
    'vd~': { aliasTo: 'delread4~' },
    'bp~': bpTilde.builder,
    'hip~': filtersHipTilde.builder,
    'lop~': filtersLopTilde.builder,
    'vcf~': filtersVcfTilde.builder,
    'delwrite~': delwriteTilde.builder,
    's~': { aliasTo: 'send~' },
    'r~': { aliasTo: 'receive~' },
    ...controlsFloat.builders,
    ...controlsAtoms.builders,
    ...binop.builders,
    ...funcs.builders,
    ...floatAndInt.builders,
    ...expr.builders,
    bang: bang.builder,
    bng: { aliasTo: 'bang' },
    b: { aliasTo: 'bang' },
    list: list.builder,
    symbol: symbol.builder,
    loadbang: loadbang.builder,
    s: { aliasTo: 'send' },
    r: { aliasTo: 'receive' },
    print: print.builder,
    trigger: trigger.builder,
    t: { aliasTo: 'trigger' },
    change: change.builder,
    clip: clip.builder,
    pipe: pipe.builder,
    moses: moses.builder,
    pack: pack.builder,
    unpack: unpack.builder,
    spigot: spigot.builder,
    until: until.builder,
    random: random.builder,
    route: route.builder,
    select: { aliasTo: 'route' },
    sel: { aliasTo: 'route' },
    msg: msg.builder,
    metro: metro.builder,
    timer: timer.builder,
    delay: delay.builder,
    del: { aliasTo: 'delay' },
    line: line.builder,
    soundfiler: soundfiler.builder,
    tabread: tabread.builder,
    tabwrite: tabwrite.builder,
    // The following are internal nodes used by the compiler
    // to help reproduce Pd's behavior
    '_mixer~': _implicitMixerTilde.builder,
    '_routemsg': _implicitMsgSort.builder,
    // The following don't need implementations as they will never
    // show up in the graph traversal.
    graph: { isNoop: true },
    table: { isNoop: true },
    array: { isNoop: true },
    text: { isNoop: true },
    cnv: { isNoop: true },
    'block~': { isNoop: true },
    openpanel: { isNoop: true },
}

const NODE_IMPLEMENTATIONS: NodeImplementations = {
    ...binopTilde.nodeImplementations,
    ...funcsTilde.nodeImplementations,
    ...oscPhasorTilde.nodeImplementations,
    ...filtersRealTilde.nodeImplementations,
    ...filtersComplexTilde.nodeImplementations,
    ...delreadTilde.nodeImplementations,
    ...throwCatchSendReceiveTilde.nodeImplementations,
    ...sendReceive.nodeImplementations,
    ...tabreadTilde.nodeImplementations,
    'noise~': noiseTilde.nodeImplementation,
    'snapshot~': snapshotTilde.nodeImplementation,
    'sig~': sigTilde.nodeImplementation,
    'samphold~': sampholdTilde.nodeImplementation,
    'clip~': clipTilde.nodeImplementation,
    'vline~': vlineTilde.nodeImplementation,
    'line~': lineTilde.nodeImplementation,
    'dac~': dacTilde.nodeImplementation,
    'adc~': adcTilde.nodeImplementation,
    'samplerate~': sampleRateTilde.nodeImplementation,
    'tabplay~': tabplayTilde.nodeImplementation,
    'tabwrite~': tabwriteTilde.nodeImplementation,
    'readsf~': readsfTilde.nodeImplementation,
    'writesf~': writesfTilde.nodeImplementation,
    'delwrite~': delwriteTilde.nodeImplementation,
    'bp~': bpTilde.nodeImplementation,
    'hip~': filtersHipTilde.nodeImplementation,
    'lop~': filtersLopTilde.nodeImplementation,
    'vcf~': filtersVcfTilde.nodeImplementation,
    ...controlsFloat.nodeImplementations,
    ...controlsAtoms.nodeImplementations,
    ...binop.nodeImplementations,
    ...floatAndInt.nodeImplementations,
    ...funcs.nodeImplementations,
    ...expr.nodeImplementations,
    bang: bang.nodeImplementation,
    list: list.nodeImplementation,
    symbol: symbol.nodeImplementation,
    loadbang: loadbang.nodeImplementation,
    print: print.nodeImplementation,
    trigger: trigger.nodeImplementation,
    change: change.nodeImplementation,
    clip: clip.nodeImplementation,
    pipe: pipe.nodeImplementation,
    moses: moses.nodeImplementation,
    pack: pack.nodeImplementation,
    unpack: unpack.nodeImplementation,
    spigot: spigot.nodeImplementation,
    until: until.nodeImplementation,
    route: route.nodeImplementation,
    random: random.nodeImplementation,
    msg: msg.nodeImplementation,
    metro: metro.nodeImplementation,
    timer: timer.nodeImplementation,
    delay: delay.nodeImplementation,
    line: line.nodeImplementation,
    tabread: tabread.nodeImplementation,
    tabwrite: tabwrite.nodeImplementation,
    soundfiler: soundfiler.nodeImplementation,
    // Internal nodes
    '_mixer~': _implicitMixerTilde.nodeImplementation,
    '_routemsg': _implicitMsgSort.nodeImplementation,
}

export { NODE_IMPLEMENTATIONS, NODE_BUILDERS }
