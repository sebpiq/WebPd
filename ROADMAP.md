# Planned features v1.0.0

```
🟥 = not planned and might never be implemented
🟧 = planned for v1.0.0 but not done yet
🟩 = done
```

🟩 **Sending messages to the patch (messageReceivers).** 

🟩 **Receiving messages from the patch (messageSenders).** 

🟧 **Box with just number inside as a shortcut for float.** 

For now, use the full `[float 8]` instead of `[8]`.

🟧 **Unpacking a list to inlets of an object.** 

As a hidden feature, some objects like `[\]` support a list instead of having to send a separate message to their inlets. 

For now, instead of :

```
   [1 4(
    |
   [ \ ] -> will send 0.25
```

use :

```
    [t b b]
     /   \
   [1(  [4(
    |  /
   [ \ ]
```

🟥 **Data structures.**

🟥 **GEM.**


# Implemented objects

NOTE : some of these objects, such as `[openpanel]` are no-ops since they are UI objects.

```
147 object supported (incomplete implementation for some) : 
[pd]
[inlet]
[outlet]
[inlet~]
[outlet~]
[+~]
[-~]
[*~]
[/~]
[min~]
[max~]
[pow~]
[log~]
[abs~]
[cos~]
[wrap~]
[sqrt~]
[exp~]
[mtof~]
[ftom~]
[osc~]
[phasor~]
[rpole~]
[rzero~]
[rzero_rev~]
[cpole~]
[czero~]
[delread~]
[delread4~] (is same as deread~, no 4-point interp.)
[throw~]
[catch~]
[send~]
[receive~]
[send]
[receive]
[tabread~]
[tabread4~] (is same as tabread4~, no 4-point interp.)
[noise~]
[snapshot~]
[sig~]
[samphold~]
[clip~]
[vline~]
[line~]
[dac~]
[adc~]
[samplerate~]
[tabplay~]
[tabwrite~]
[readsf~]
[writesf~]
[vd~]
[bp~]
[hip~]
[lop~]
[vcf~] (algorithm is different from Pd's)
[delwrite~]
[s~]
[r~]
[tgl]
[nbx]
[hsl]
[vsl]
[hradio]
[vradio]
[floatatom]
[symbolatom]
[listbox]
[+]
[-]
[*]
[/]
[max]
[min]
[mod]
[%]
[pow]
[log]
[atan2]
[||]
[&&]
[>]
[>=]
[<]
[<=]
[==]
[!=]
[abs]
[cos]
[sin]
[tan]
[atan]
[exp]
[wrap]
[sqrt]
[mtof]
[ftom]
[rmstodb]
[dbtorms]
[powtodb]
[dbtopow]
[vu]
[float]
[f]
[int]
[i]
[expr]
[expr~]
[bang]
[bng]
[b]
[list]
[symbol]
[loadbang]
[s]
[r]
[print]
[trigger]
[t]
[change]
[clip]
[pipe]
[moses]
[pack]
[unpack]
[spigot]
[until]
[random]
[route]
[select]
[sel]
[msg]
[metro]
[timer]
[delay]
[del]
[line]
[soundfiler]
[tabread]
[tabwrite]
[graph] (does nothing, as WebPd is not a UI library)
[table]
[array]
[text] (does nothing, as WebPd is not a UI library)
[cnv]
[block~]
[openpanel] (does nothing, as WebPd is not a UI library)
```