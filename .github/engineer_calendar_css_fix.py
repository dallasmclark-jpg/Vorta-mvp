from pathlib import Path

p = Path('src/screens/EngineerPortal/EngineerRotaScreen.tsx')
s = p.read_text()

replacements = {
'''function calendarEntryTone(value: EngineerCalendarEntryType): string {
  switch (value) {
    case "training":
      return "border-violet-400/30 bg-violet-500/[0.10] text-violet-200";
    case "overtime":
      return "border-cyan-400/30 bg-cyan-500/[0.10] text-cyan-200";
    case "annual_leave":
      return "border-amber-400/30 bg-amber-500/[0.10] text-amber-200";
    case "appointment":
      return "border-pink-400/30 bg-pink-500/[0.10] text-pink-200";
    case "other":
      return "border-slate-600/60 bg-slate-800/45 text-slate-300";
    default:
      return "border-blue-400/30 bg-blue-500/[0.10] text-blue-200";
  }
}
''': '''function calendarEntryTone(_value: EngineerCalendarEntryType): string {
  return "border-slate-700/75 bg-slate-950/35 text-slate-300";
}
''',
'border border-blue-500/25 bg-blue-500/[0.08] px-3 text-xs font-semibold text-blue-200': 'border border-slate-700/80 bg-[#030c1d] px-3 text-xs font-semibold text-slate-200',
'hover:border-red-400/35 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400': 'hover:border-slate-700/75 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
'outline-none placeholder:text-slate-600 focus:border-blue-400/60': 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
'outline-none focus:border-blue-400/60': 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
'font-medium normal-case tracking-normal text-slate-200': 'font-medium text-slate-200',
'font-medium normal-case tracking-normal text-slate-100': 'font-medium text-slate-100',
'normal-case tracking-normal text-slate-600': 'text-slate-600',
'resize-none rounded-xl': 'rounded-xl',
'bg-cyan-300': 'bg-blue-500/35',
}

for old, new in replacements.items():
    if old not in s:
        print(f'Notice: replacement target absent: {old[:80]}')
    s = s.replace(old, new)

p.write_text(s)
