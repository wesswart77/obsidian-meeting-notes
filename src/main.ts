import {
  App,
  ItemView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  WorkspaceLeaf,
  moment,
} from "obsidian";

// ─── Settings ─────────────────────────────────────────────────────────────────

interface MeetingNotesSettings {
  meetingsFolder: string;
  actionsNotePath: string;
}

const DEFAULT_SETTINGS: MeetingNotesSettings = {
  meetingsFolder: "Meetings",
  actionsNotePath: "Meetings/Action Items.md",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type MeetingType = "1:1" | "team" | "client" | "all-hands";

interface MeetingEntry {
  title: string;
  date: string;
  attendees: string[];
  meetingType: MeetingType;
  actionCount: number;
  file: TFile;
}

// ─── Sidebar View ─────────────────────────────────────────────────────────────

const MEETING_VIEW_TYPE = "meeting-notes-sidebar";

class MeetingSidebarView extends ItemView {
  plugin: MeetingNotesPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: MeetingNotesPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return MEETING_VIEW_TYPE; }
  getDisplayText() { return "Meeting Notes"; }
  getIcon() { return "calendar-clock"; }

  async onOpen() { await this.render(); }

  async render() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("meeting-sidebar");

    const header = container.createEl("div", { cls: "meeting-sidebar-header" });
    header.createEl("h4", { text: "Meeting Notes" });

    const newBtn = header.createEl("button", {
      text: "+ New Meeting",
      cls: "meeting-new-btn",
    });
    newBtn.addEventListener("click", () => {
      new NewMeetingModal(this.app, this.plugin, async () => {
        await this.render();
      }).open();
    });

    const meetings = await this.getMeetingEntries();

    if (meetings.length === 0) {
      container.createEl("p", {
        text: "No meetings found. Create your first meeting note!",
        cls: "meeting-empty",
      });
      return;
    }

    const list = container.createEl("div", { cls: "meeting-list" });

    for (const meeting of meetings) {
      const item = list.createEl("div", { cls: "meeting-item" });

      const nameEl = item.createEl("a", {
        text: meeting.title,
        cls: "meeting-item-name",
      });
      nameEl.addEventListener("click", () => {
        this.app.workspace.openLinkText(meeting.file.path, "", false);
      });

      const meta = item.createEl("div", { cls: "meeting-item-meta" });

      meta.createEl("span", { text: meeting.date, cls: "meeting-date" });

      meta.createEl("span", {
        text: meeting.meetingType,
        cls: "meeting-type-badge type-" + meeting.meetingType.replace(":", ""),
      });

      if (meeting.attendees.length > 0) {
        meta.createEl("span", {
          text: meeting.attendees.length + " attendee" + (meeting.attendees.length !== 1 ? "s" : ""),
          cls: "meeting-attendee-count",
        });
      }

      if (meeting.actionCount > 0) {
        meta.createEl("span", {
          text: meeting.actionCount + " action" + (meeting.actionCount !== 1 ? "s" : ""),
          cls: "meeting-action-count",
        });
      }
    }
  }

  async getMeetingEntries(): Promise<MeetingEntry[]> {
    const folder = this.plugin.settings.meetingsFolder;
    const files = this.app.vault.getMarkdownFiles().filter((f) =>
      f.path.startsWith(folder + "/")
    );

    const entries: MeetingEntry[] = [];

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter;
      if (!fm || fm.type !== "meeting") continue;

      const attendeesRaw = fm.attendees ?? "";
      const attendees: string[] = typeof attendeesRaw === "string"
        ? attendeesRaw.split(",").map((a: string) => a.trim()).filter(Boolean)
        : Array.isArray(attendeesRaw) ? attendeesRaw : [];

      entries.push({
        title: fm.title ?? file.basename,
        date: fm.date ?? "",
        attendees,
        meetingType: fm.meeting_type ?? "team",
        actionCount: Number(fm.action_count) || 0,
        file,
      });
    }

    entries.sort((a, b) => b.date.localeCompare(a.date));
    return entries;
  }
}

// ─── New Meeting Modal ────────────────────────────────────────────────────────

class NewMeetingModal extends Modal {
  plugin: MeetingNotesPlugin;
  private onCreated: () => Promise<void>;
  private title = "";
  private date = "";
  private attendees = "";
  private meetingType: MeetingType = "team";
  private agenda = "";

  constructor(app: App, plugin: MeetingNotesPlugin, onCreated: () => Promise<void>) {
    super(app);
    this.plugin = plugin;
    this.onCreated = onCreated;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "New Meeting" });

    new Setting(contentEl).setName("Meeting title").addText((t) => {
      t.setPlaceholder("e.g. Q2 Planning Session");
      t.onChange((v) => (this.title = v.trim()));
    });

    new Setting(contentEl).setName("Date").addText((t) => {
      const today = moment().format("YYYY-MM-DD");
      t.setPlaceholder("YYYY-MM-DD").setValue(today);
      this.date = today;
      t.onChange((v) => (this.date = v.trim()));
    });

    new Setting(contentEl)
      .setName("Attendees")
      .setDesc("Comma-separated names")
      .addText((t) => {
        t.setPlaceholder("Alice, Bob, Carol");
        t.onChange((v) => (this.attendees = v.trim()));
      });

    new Setting(contentEl).setName("Meeting type").addDropdown((dd) => {
      dd.addOption("1:1", "1:1")
        .addOption("team", "Team")
        .addOption("client", "Client")
        .addOption("all-hands", "All-Hands");
      dd.setValue("team").onChange((v) => (this.meetingType = v as MeetingType));
    });

    new Setting(contentEl)
      .setName("Agenda")
      .setDesc("Key topics to cover")
      .addTextArea((ta) => {
        ta.setPlaceholder("1. Review Q1 results\n2. Set Q2 goals\n3. AOB");
        ta.inputEl.rows = 5;
        ta.onChange((v) => (this.agenda = v));
      });

    new Setting(contentEl).addButton((btn) => {
      btn.setButtonText("Create Meeting Note").setCta().onClick(() => this.create());
    });
  }

  async create() {
    if (!this.title) { new Notice("Meeting title is required."); return; }
    if (!this.date) { new Notice("Date is required."); return; }

    const folder = this.plugin.settings.meetingsFolder;
    await this.plugin.ensureFolder(folder);

    const attendeeList = this.attendees
      ? this.attendees.split(",").map((a) => a.trim()).filter(Boolean)
      : [];

    const agendaLines = this.agenda
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => "- " + l)
      .join("\n");

    const safeTitle = this.title.replace(/[\\/:*?"<>|]/g, "-");
    const fileName = this.date + " " + safeTitle + ".md";
    const filePath = folder + "/" + fileName;

    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing) {
      new Notice("Meeting note already exists.");
      await this.app.workspace.openLinkText(filePath, "", false);
      this.close();
      return;
    }

    const attendeeYaml = attendeeList.length > 0
      ? 'attendees: "' + attendeeList.join(", ") + '"'
      : 'attendees: ""';

    const content = [
      "---",
      "type: meeting",
      'title: "' + this.title + '"',
      'date: "' + this.date + '"',
      attendeeYaml,
      'meeting_type: "' + this.meetingType + '"',
      "action_count: 0",
      "---",
      "",
      "# " + this.title,
      "",
      "> **Date:** " + this.date,
      "> **Type:** " + this.meetingType,
      "> **Attendees:** " + (attendeeList.join(", ") || "—"),
      "",
      "## Agenda",
      "",
      agendaLines || "_No agenda items set._",
      "",
      "## Notes",
      "",
      "_Meeting notes go here._",
      "",
      "## Decisions",
      "",
      "_Record any decisions made during the meeting._",
      "",
      "## Action Items",
      "",
      "_Format: - [ ] Description @owner_",
      "",
    ].join("\n");

    const file = await this.app.vault.create(filePath, content);
    new Notice('Meeting note "' + this.title + '" created!');
    await this.app.workspace.openLinkText(file.path, "", false);
    await this.onCreated();
    this.close();
  }

  onClose() { this.contentEl.empty(); }
}

// ─── Extract Actions Command ──────────────────────────────────────────────────

async function extractActions(plugin: MeetingNotesPlugin) {
  const activeFile = plugin.app.workspace.getActiveFile();
  if (!activeFile) {
    new Notice("No active file. Open a meeting note first.");
    return;
  }

  const cache = plugin.app.metadataCache.getFileCache(activeFile);
  if (cache?.frontmatter?.type !== "meeting") {
    new Notice("Active file is not a meeting note.");
    return;
  }

  const content = await plugin.app.vault.read(activeFile);
  const lines = content.split("\n");

  // Find unchecked action items
  const actionItems: string[] = [];
  let inActionsSection = false;

  for (const line of lines) {
    if (line.startsWith("## Action Items")) {
      inActionsSection = true;
      continue;
    }
    if (inActionsSection && line.startsWith("## ")) {
      inActionsSection = false;
    }
    if (inActionsSection && /^- \[ \]/.test(line)) {
      actionItems.push(line.trim());
    }
  }

  if (actionItems.length === 0) {
    new Notice("No unchecked action items found in this meeting note.");
    return;
  }

  const actionsPath = plugin.settings.actionsNotePath;
  const actionsFolderPath = actionsPath.substring(0, actionsPath.lastIndexOf("/"));
  if (actionsFolderPath) {
    await plugin.ensureFolder(actionsFolderPath);
  }

  const meetingRef = "[[" + activeFile.basename + "]]";
  const date = cache?.frontmatter?.date ?? moment().format("YYYY-MM-DD");
  const section = [
    "",
    "### From " + meetingRef + " (" + date + ")",
    "",
    ...actionItems,
    "",
  ].join("\n");

  const existingActionsFile = plugin.app.vault.getAbstractFileByPath(actionsPath);
  if (existingActionsFile instanceof TFile) {
    const existing = await plugin.app.vault.read(existingActionsFile);
    await plugin.app.vault.modify(existingActionsFile, existing + section);
  } else {
    const header = [
      "---",
      "type: actions",
      "---",
      "",
      "# Action Items",
      "",
    ].join("\n");
    await plugin.app.vault.create(actionsPath, header + section);
  }

  // Update action_count in frontmatter
  const updatedContent = content.replace(
    /^action_count: \d+/m,
    "action_count: " + actionItems.length
  );
  await plugin.app.vault.modify(activeFile, updatedContent);

  new Notice(actionItems.length + " action item" + (actionItems.length !== 1 ? "s" : "") + " extracted to " + actionsPath);

  const actionsFile = plugin.app.vault.getAbstractFileByPath(actionsPath);
  if (actionsFile instanceof TFile) {
    await plugin.app.workspace.openLinkText(actionsFile.path, "", false);
  }
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

class MeetingNotesSettingTab extends PluginSettingTab {
  plugin: MeetingNotesPlugin;
  constructor(app: App, plugin: MeetingNotesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Meeting Notes Settings" });

    new Setting(containerEl)
      .setName("Meetings folder")
      .setDesc("Folder where meeting notes are stored.")
      .addText((t) => {
        t.setPlaceholder("Meetings")
          .setValue(this.plugin.settings.meetingsFolder)
          .onChange(async (v) => {
            this.plugin.settings.meetingsFolder = v.trim() || "Meetings";
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Actions note path")
      .setDesc("Path to the master action items note.")
      .addText((t) => {
        t.setPlaceholder("Meetings/Action Items.md")
          .setValue(this.plugin.settings.actionsNotePath)
          .onChange(async (v) => {
            this.plugin.settings.actionsNotePath = v.trim() || "Meetings/Action Items.md";
            await this.plugin.saveSettings();
          });
      });
  }
}

// ─── Main Plugin ─────────────────────────────────────────────────────────────

export default class MeetingNotesPlugin extends Plugin {
  settings: MeetingNotesSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    this.registerView(MEETING_VIEW_TYPE, (leaf) => new MeetingSidebarView(leaf, this));

    this.addCommand({
      id: "open-meeting-sidebar",
      name: "Open Meetings sidebar",
      callback: () => this.activateSidebar(),
    });

    this.addCommand({
      id: "new-meeting",
      name: "New Meeting",
      callback: () =>
        new NewMeetingModal(this.app, this, async () => {
          await this.refreshSidebar();
        }).open(),
    });

    this.addCommand({
      id: "extract-actions",
      name: "Extract Action Items",
      callback: () => extractActions(this),
    });

    this.addRibbonIcon("calendar-clock", "Meeting Notes", () => this.activateSidebar());
    this.addSettingTab(new MeetingNotesSettingTab(this.app, this));
  }

  async activateSidebar() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(MEETING_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
      await leaf.setViewState({ type: MEETING_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
    await (leaf.view as MeetingSidebarView).render();
  }

  async refreshSidebar() {
    for (const leaf of this.app.workspace.getLeavesOfType(MEETING_VIEW_TYPE)) {
      await (leaf.view as MeetingSidebarView).render();
    }
  }

  async ensureFolder(path: string) {
    if (!this.app.vault.getAbstractFileByPath(path)) {
      await this.app.vault.createFolder(path);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() { await this.saveData(this.settings); }
}
