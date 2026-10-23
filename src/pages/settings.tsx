import { type ReactNode, useState } from "react"
import { open } from "@tauri-apps/plugin-dialog"
import { FolderOutput, Monitor, Moon, Sun } from "lucide-react"

import { version } from "../../package.json"
import { Page, PageHeader, SectionTitle } from "@/components/page"
import { Button } from "@/components/ui/button"
import { HaloBadge } from "@/components/ui/halo-badge"
import { GradientButtonGroup } from "@/components/ui/gradient-button-group"
import { showPolishedToast } from "@/components/ui/halo-toast"
import NeumorphButton from "@/components/ui/neumorph-button"
import { Switch } from "@/components/ui/switch"
import { PixelHeading } from "@/components/ui/pixel-heading-character"
import { basename } from "@/lib/format"
import { type Theme, useApp } from "@/store"

function Row({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3.5">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <SectionTitle>{title}</SectionTitle>
      <div className="bg-card divide-y rounded-xl border">{children}</div>
    </section>
  )
}

export function SettingsPage() {
  const settings = useApp((s) => s.settings)
  const updateSettings = useApp((s) => s.updateSettings)
  const clearFinishedJobs = useApp((s) => s.clearFinishedJobs)
  const clearHistory = useApp((s) => s.clearHistory)
  const historyCount = useApp((s) => s.history?.length ?? 0)
  const [confirming, setConfirming] = useState(false)

  const confirmClearHistory = async () => {
    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 4000)
      return
    }
    setConfirming(false)
    await clearHistory()
    showPolishedToast({ title: "History cleared", description: "The Dashboard starts fresh.", rimVariant: "success" })
  }

  const chooseOutputDir = async () => {
    const dir = await open({ directory: true, title: "Save results to" })
    if (typeof dir === "string") updateSettings({ outputDir: dir })
  }

  return (
    <Page className="max-w-3xl">
      <PageHeader title="Settings" />

      <Group title="Output">
        <Row title="Save results to" description="Where tools write their output by default.">
          <Button variant="outline" size="sm" className="max-w-56" onClick={chooseOutputDir}>
            <FolderOutput />
            <span className="truncate">{settings.outputDir ? basename(settings.outputDir) : "Next to the original"}</span>
          </Button>
          {settings.outputDir && (
            <Button variant="ghost" size="sm" onClick={() => updateSettings({ outputDir: null })}>
              Reset
            </Button>
          )}
        </Row>
      </Group>

      <Group title="Terminal">
        <Row title="Close when clicking outside" description="Clicking anywhere outside the terminal hides it, like a popover.">
          <Switch
            checked={settings.terminalClosesOnOutsideClick}
            onCheckedChange={(terminalClosesOnOutsideClick) => updateSettings({ terminalClosesOnOutsideClick })}
          />
        </Row>
        <Row title="Height" description="Drag the terminal's top edge to resize it. Double-click the edge to go back to the default.">
          <Button
            variant="ghost"
            size="sm"
            disabled={settings.terminalHeight === null}
            onClick={() => updateSettings({ terminalHeight: null })}
          >
            {settings.terminalHeight === null ? "Default" : `${settings.terminalHeight}px · Reset`}
          </Button>
        </Row>
      </Group>

      <Group title="Appearance">
        <div className="flex items-center justify-between gap-6 px-4 py-5">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Theme</p>
            <p className="text-muted-foreground text-xs">System follows your macOS appearance.</p>
          </div>
          <GradientButtonGroup<Theme>
            aria-label="Theme"
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
            items={[
              { id: "system", label: "System", icon: <Monitor /> },
              { id: "light", label: "Light", icon: <Sun /> },
              { id: "dark", label: "Dark", icon: <Moon /> },
            ]}
          />
        </div>
      </Group>

      <Group title="Data">
        <Row title="Clear this session" description="Remove finished jobs from the terminal. Running jobs are kept.">
          <NeumorphButton size="small" onClick={clearFinishedJobs}>
            Clear
          </NeumorphButton>
        </Row>
        <Row
          title="Clear history"
          description={`Delete all ${historyCount.toLocaleString()} saved jobs. The Dashboard charts start from zero.`}
        >
          <NeumorphButton size="small" intent="danger" onClick={confirmClearHistory}>
            {confirming ? "Click again to delete" : "Clear history"}
          </NeumorphButton>
        </Row>
      </Group>

      <Group title="About">
        <div className="flex items-center justify-between gap-6 px-4 py-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <PixelHeading as="h3" mode="wave" showLabel={false} className="text-xl leading-none font-semibold tracking-tight">
                Pyx
              </PixelHeading>
              <HaloBadge variant="outline" tabularNums>
                v{version}
              </HaloBadge>
            </div>
            <p className="text-muted-foreground text-xs">A media workbench for macOS, built on ffmpeg and ImageMagick.</p>
          </div>
          <p className="text-muted-foreground shrink-0 text-sm">
            Developed by <span className="text-foreground font-semibold">Nyx</span>
          </p>
        </div>
      </Group>
    </Page>
  )
}
