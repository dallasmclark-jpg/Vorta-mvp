from pathlib import Path

path = Path("src/screens/AiOperations/AskVortaWorkspace.tsx")
source = path.read_text()

replacements = {
    "bg-[#080b10]": "bg-gray-950",
    "w-[272px]": "w-64",
    "bg-[#0d1118]": "bg-gray-950",
    "bg-[#0b0f15]": "bg-gray-950",
    "bg-[#10151e]": "bg-gray-900",
    "bg-[#0c1017]": "bg-gray-950",
    "max-w-[960px]": "max-w-4xl",
    "max-w-[1040px]": "max-w-5xl",
    "max-w-[360px]": "max-w-sm",
    "max-w-[76%]": "max-w-3xl",
    "tracking-[0.16em]": "tracking-widest",
    "bg-white/[0.04]": "bg-white/5",
    "bg-blue-500/[0.06]": "bg-blue-500/10",
    "bg-amber-500/[0.07]": "bg-amber-500/10",
    "lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]": "lg:grid-cols-3",
    '<section className="space-y-5">': '<section className="space-y-5 lg:col-span-2">',
}

for old, new in replacements.items():
    source = source.replace(old, new)

path.write_text(source)
