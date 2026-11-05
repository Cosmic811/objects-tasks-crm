import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const names = execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean)
const files = [...new Set(names)]
const findings = []
for (const file of files) {
  if (/^\.env/.test(file) && !['.env.example','.env.test.example'].includes(file)) findings.push(file+': private env file')
  if (!/\.(md|ts|tsx|mjs|sql|toml|json|yml|css|html)$/.test(file) && !file.startsWith('.env')) continue
  const text = await readFile(file,'utf8')
  if (/sb_secret_[A-Za-z0-9_-]+|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) findings.push(file+': credential pattern')
  for (const token of text.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try { if (JSON.parse(Buffer.from(token[0].split('.')[1], 'base64url')).role === 'service_role') findings.push(file+': service role JWT') }
    catch { /* Non-JWT source snippets are not credentials. */ }
  }
  if (/\b[A-Z]:[\\/]|\/Users\/[^/ ]+|\/home\/[^/ ]+/i.test(text)) findings.push(file+': absolute local path')
  if (file.endsWith('.md') && text.includes('—')) findings.push(file+': long dash in employer text')
  if (file.endsWith('.md')) {
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target=match[1]
      if (/^(?:https?:|#)/.test(target)) continue
      try { await readFile(new URL(target,new URL('../'+file,import.meta.url))) }
      catch { findings.push(file+': broken link '+target) }
    }
  }
}
console.log(JSON.stringify({filesChecked:files.length,findings},null,2))
process.exitCode=findings.length?1:0
