// ABOUT: Client-side naturalist verification challenge (CAPTCHA alternative)
// ABOUT: Presents a random multiple-choice question; calls onVerified after a correct answer

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

interface Challenge {
  question: string
  options: string[]
  answer: string
}

const CHALLENGES: Challenge[] = [
  {
    question: 'The naturalist asks: which of these is a genuine order of insects?',
    options: ['Coleoptera', 'Fragmentosa', 'Spiralidae', 'Nocturvia'],
    answer: 'Coleoptera',
  },
  {
    question: 'A matter of natural philosophy: what does an entomologist study?',
    options: ['Rocks', 'Stars', 'Insects', 'Tides'],
    answer: 'Insects',
  },
  {
    question: 'Pray tell — which creature possesses eight legs?',
    options: ['Beetle', 'Spider', 'Crab', 'Centipede'],
    answer: 'Spider',
  },
  {
    question: 'The curator enquires: which of these is a precious stone?',
    options: ['Basalt', 'Amethyst', 'Slate', 'Chalk'],
    answer: 'Amethyst',
  },
  {
    question: 'A test of observation: which colour does one obtain by mixing blue and yellow?',
    options: ['Red', 'Orange', 'Green', 'Purple'],
    answer: 'Green',
  },
  {
    question: 'The gatekeeper asks: in which season do deciduous trees shed their leaves?',
    options: ['Spring', 'Summer', 'Autumn', 'Winter'],
    answer: 'Autumn',
  },
  {
    question: 'A simple verification: which of these is found in the ocean?',
    options: ['Oak tree', 'Coral reef', 'Mountain goat', 'Sparrow'],
    answer: 'Coral reef',
  },
  {
    question: 'The librarian enquires: how many sides has a hexagon?',
    options: ['Five', 'Six', 'Seven', 'Eight'],
    answer: 'Six',
  },
]

interface Props {
  onVerified: () => void
}

export function VictorianCaptcha({ onVerified }: Props) {
  const challenge = useMemo(
    () => CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)],
    [],
  )
  const [selected, setSelected] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle')

  const handleSelect = (option: string) => {
    if (status === 'correct') return
    setSelected(option)
    if (option === challenge.answer) {
      setStatus('correct')
      setTimeout(() => onVerified(), 600)
    } else {
      setStatus('wrong')
      setTimeout(() => {
        setSelected(null)
        setStatus('idle')
      }, 800)
    }
  }

  return (
    <div className="border rounded-sm bg-card overflow-hidden">
      <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
          <div className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
          <div className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
        </div>
        <span className="font-mono text-[9px] tracking-[3px] text-muted-foreground uppercase">
          Naturalist Verification
        </span>
      </div>

      <div className="px-4 py-4 space-y-3">
        <p className="font-serif text-sm italic text-foreground/80 leading-relaxed">
          {challenge.question}
        </p>

        <div className="grid grid-cols-2 gap-2">
          {challenge.options.map((option) => {
            const isSelected = selected === option
            const isCorrect = status === 'correct' && isSelected
            const isWrong = status === 'wrong' && isSelected

            return (
              <button
                key={option}
                onClick={() => handleSelect(option)}
                disabled={status === 'correct'}
                className={cn(
                  'px-3 py-2 rounded-sm border text-left font-serif text-sm transition-all duration-200',
                  isCorrect && 'bg-emerald-50 border-emerald-400 text-emerald-800',
                  isWrong && 'bg-red-50 border-red-300 text-red-700',
                  !isSelected && status !== 'correct' && 'hover:bg-muted/50 hover:border-foreground/20',
                  status === 'correct' && !isSelected && 'opacity-40',
                )}
              >
                {option}
              </button>
            )
          })}
        </div>

        {status === 'correct' && (
          <p className="font-mono text-[10px] tracking-wider text-emerald-600 text-center">
            VERIFIED — WELCOME, FELLOW NATURALIST
          </p>
        )}
        {status === 'wrong' && (
          <p className="font-mono text-[10px] tracking-wider text-red-500 text-center">
            INCORRECT — PLEASE TRY AGAIN
          </p>
        )}
      </div>
    </div>
  )
}
