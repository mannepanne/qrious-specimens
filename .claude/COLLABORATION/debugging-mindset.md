# Debugging mindset

A scientific approach: understand what's actually happening before fixing anything.

## Core principles

- **Read the error messages first** — they're usually trying to tell you exactly what's wrong
- **Look for root causes, not symptoms** — fixing the underlying issue prevents it coming back
- **One change at a time** — if you change multiple things, you won't know what actually worked
- **Check what changed recently** — `git diff` and recent commits often point to the culprit
- **Find working examples** — there's usually similar code in the project that works correctly

## When things get tricky

- **Say "I don't understand X"** rather than guessing — better to ask than to compound the problem
- **Look for patterns** — is this breaking in similar ways elsewhere? Are we missing a dependency?
- **Test your hypothesis** — make the smallest change possible to test one specific theory
- **If the first fix doesn't work, stop and reassess** — piling on more fixes usually makes things worse

## Practical reality check

Sometimes you need to move fast and the "proper" approach isn't practical. That's fine — just flag it so we can come back and clean things up later. If accruing technical debt or taking a shortcut, write it down in [technical-debt.md](../../REFERENCE/technical-debt.md) so we don't forget.

The goal is sustainable progress, not perfect process.
