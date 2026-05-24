var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MeetingNotesPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  meetingsFolder: "Meetings",
  actionsNotePath: "Meetings/Action Items.md"
};
var MEETING_VIEW_TYPE = "meeting-notes-sidebar";
var MeetingSidebarView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return MEETING_VIEW_TYPE;
  }
  getDisplayText() {
    return "Meeting Notes";
  }
  getIcon() {
    return "calendar-clock";
  }
  async onOpen() {
    await this.render();
  }
  async render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("meeting-sidebar");
    const header = container.createEl("div", { cls: "meeting-sidebar-header" });
    header.createEl("h4", { text: "Meeting Notes" });
    const newBtn = header.createEl("button", {
      text: "+ New Meeting",
      cls: "meeting-new-btn"
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
        cls: "meeting-empty"
      });
      return;
    }
    const list = container.createEl("div", { cls: "meeting-list" });
    for (const meeting of meetings) {
      const item = list.createEl("div", { cls: "meeting-item" });
      const nameEl = item.createEl("a", {
        text: meeting.title,
        cls: "meeting-item-name"
      });
      nameEl.addEventListener("click", () => {
        this.app.workspace.openLinkText(meeting.file.path, "", false);
      });
      const meta = item.createEl("div", { cls: "meeting-item-meta" });
      meta.createEl("span", { text: meeting.date, cls: "meeting-date" });
      meta.createEl("span", {
        text: meeting.meetingType,
        cls: "meeting-type-badge type-" + meeting.meetingType.replace(":", "")
      });
      if (meeting.attendees.length > 0) {
        meta.createEl("span", {
          text: meeting.attendees.length + " attendee" + (meeting.attendees.length !== 1 ? "s" : ""),
          cls: "meeting-attendee-count"
        });
      }
      if (meeting.actionCount > 0) {
        meta.createEl("span", {
          text: meeting.actionCount + " action" + (meeting.actionCount !== 1 ? "s" : ""),
          cls: "meeting-action-count"
        });
      }
    }
  }
  async getMeetingEntries() {
    var _a, _b, _c, _d;
    const folder = this.plugin.settings.meetingsFolder;
    const files = this.app.vault.getMarkdownFiles().filter(
      (f) => f.path.startsWith(folder + "/")
    );
    const entries = [];
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache == null ? void 0 : cache.frontmatter;
      if (!fm || fm.type !== "meeting")
        continue;
      const attendeesRaw = (_a = fm.attendees) != null ? _a : "";
      const attendees = typeof attendeesRaw === "string" ? attendeesRaw.split(",").map((a) => a.trim()).filter(Boolean) : Array.isArray(attendeesRaw) ? attendeesRaw : [];
      entries.push({
        title: (_b = fm.title) != null ? _b : file.basename,
        date: (_c = fm.date) != null ? _c : "",
        attendees,
        meetingType: (_d = fm.meeting_type) != null ? _d : "team",
        actionCount: Number(fm.action_count) || 0,
        file
      });
    }
    entries.sort((a, b) => b.date.localeCompare(a.date));
    return entries;
  }
};
var NewMeetingModal = class extends import_obsidian.Modal {
  constructor(app, plugin, onCreated) {
    super(app);
    this.title = "";
    this.date = "";
    this.attendees = "";
    this.meetingType = "team";
    this.agenda = "";
    this.plugin = plugin;
    this.onCreated = onCreated;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "New Meeting" });
    new import_obsidian.Setting(contentEl).setName("Meeting title").addText((t) => {
      t.setPlaceholder("e.g. Q2 Planning Session");
      t.onChange((v) => this.title = v.trim());
    });
    new import_obsidian.Setting(contentEl).setName("Date").addText((t) => {
      const today = (0, import_obsidian.moment)().format("YYYY-MM-DD");
      t.setPlaceholder("YYYY-MM-DD").setValue(today);
      this.date = today;
      t.onChange((v) => this.date = v.trim());
    });
    new import_obsidian.Setting(contentEl).setName("Attendees").setDesc("Comma-separated names").addText((t) => {
      t.setPlaceholder("Alice, Bob, Carol");
      t.onChange((v) => this.attendees = v.trim());
    });
    new import_obsidian.Setting(contentEl).setName("Meeting type").addDropdown((dd) => {
      dd.addOption("1:1", "1:1").addOption("team", "Team").addOption("client", "Client").addOption("all-hands", "All-Hands");
      dd.setValue("team").onChange((v) => this.meetingType = v);
    });
    new import_obsidian.Setting(contentEl).setName("Agenda").setDesc("Key topics to cover").addTextArea((ta) => {
      ta.setPlaceholder("1. Review Q1 results\n2. Set Q2 goals\n3. AOB");
      ta.inputEl.rows = 5;
      ta.onChange((v) => this.agenda = v);
    });
    new import_obsidian.Setting(contentEl).addButton((btn) => {
      btn.setButtonText("Create Meeting Note").setCta().onClick(() => this.create());
    });
  }
  async create() {
    if (!this.title) {
      new import_obsidian.Notice("Meeting title is required.");
      return;
    }
    if (!this.date) {
      new import_obsidian.Notice("Date is required.");
      return;
    }
    const folder = this.plugin.settings.meetingsFolder;
    await this.plugin.ensureFolder(folder);
    const attendeeList = this.attendees ? this.attendees.split(",").map((a) => a.trim()).filter(Boolean) : [];
    const agendaLines = this.agenda.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => "- " + l).join("\n");
    const safeTitle = this.title.replace(/[\\/:*?"<>|]/g, "-");
    const fileName = this.date + " " + safeTitle + ".md";
    const filePath = folder + "/" + fileName;
    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing) {
      new import_obsidian.Notice("Meeting note already exists.");
      await this.app.workspace.openLinkText(filePath, "", false);
      this.close();
      return;
    }
    const attendeeYaml = attendeeList.length > 0 ? 'attendees: "' + attendeeList.join(", ") + '"' : 'attendees: ""';
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
      "> **Attendees:** " + (attendeeList.join(", ") || "\u2014"),
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
      ""
    ].join("\n");
    const file = await this.app.vault.create(filePath, content);
    new import_obsidian.Notice('Meeting note "' + this.title + '" created!');
    await this.app.workspace.openLinkText(file.path, "", false);
    await this.onCreated();
    this.close();
  }
  onClose() {
    this.contentEl.empty();
  }
};
async function extractActions(plugin) {
  var _a, _b, _c;
  const activeFile = plugin.app.workspace.getActiveFile();
  if (!activeFile) {
    new import_obsidian.Notice("No active file. Open a meeting note first.");
    return;
  }
  const cache = plugin.app.metadataCache.getFileCache(activeFile);
  if (((_a = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _a.type) !== "meeting") {
    new import_obsidian.Notice("Active file is not a meeting note.");
    return;
  }
  const content = await plugin.app.vault.read(activeFile);
  const lines = content.split("\n");
  const actionItems = [];
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
    new import_obsidian.Notice("No unchecked action items found in this meeting note.");
    return;
  }
  const actionsPath = plugin.settings.actionsNotePath;
  const actionsFolderPath = actionsPath.substring(0, actionsPath.lastIndexOf("/"));
  if (actionsFolderPath) {
    await plugin.ensureFolder(actionsFolderPath);
  }
  const meetingRef = "[[" + activeFile.basename + "]]";
  const date = (_c = (_b = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _b.date) != null ? _c : (0, import_obsidian.moment)().format("YYYY-MM-DD");
  const section = [
    "",
    "### From " + meetingRef + " (" + date + ")",
    "",
    ...actionItems,
    ""
  ].join("\n");
  const existingActionsFile = plugin.app.vault.getAbstractFileByPath(actionsPath);
  if (existingActionsFile instanceof import_obsidian.TFile) {
    const existing = await plugin.app.vault.read(existingActionsFile);
    await plugin.app.vault.modify(existingActionsFile, existing + section);
  } else {
    const header = [
      "---",
      "type: actions",
      "---",
      "",
      "# Action Items",
      ""
    ].join("\n");
    await plugin.app.vault.create(actionsPath, header + section);
  }
  const updatedContent = content.replace(
    /^action_count: \d+/m,
    "action_count: " + actionItems.length
  );
  await plugin.app.vault.modify(activeFile, updatedContent);
  new import_obsidian.Notice(actionItems.length + " action item" + (actionItems.length !== 1 ? "s" : "") + " extracted to " + actionsPath);
  const actionsFile = plugin.app.vault.getAbstractFileByPath(actionsPath);
  if (actionsFile instanceof import_obsidian.TFile) {
    await plugin.app.workspace.openLinkText(actionsFile.path, "", false);
  }
}
var MeetingNotesSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Meeting Notes Settings" });
    new import_obsidian.Setting(containerEl).setName("Meetings folder").setDesc("Folder where meeting notes are stored.").addText((t) => {
      t.setPlaceholder("Meetings").setValue(this.plugin.settings.meetingsFolder).onChange(async (v) => {
        this.plugin.settings.meetingsFolder = v.trim() || "Meetings";
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Actions note path").setDesc("Path to the master action items note.").addText((t) => {
      t.setPlaceholder("Meetings/Action Items.md").setValue(this.plugin.settings.actionsNotePath).onChange(async (v) => {
        this.plugin.settings.actionsNotePath = v.trim() || "Meetings/Action Items.md";
        await this.plugin.saveSettings();
      });
    });
  }
};
var MeetingNotesPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(MEETING_VIEW_TYPE, (leaf) => new MeetingSidebarView(leaf, this));
    this.addCommand({
      id: "open-meeting-sidebar",
      name: "Open Meetings sidebar",
      callback: () => this.activateSidebar()
    });
    this.addCommand({
      id: "new-meeting",
      name: "New Meeting",
      callback: () => new NewMeetingModal(this.app, this, async () => {
        await this.refreshSidebar();
      }).open()
    });
    this.addCommand({
      id: "extract-actions",
      name: "Extract Action Items",
      callback: () => extractActions(this)
    });
    this.addRibbonIcon("calendar-clock", "Meeting Notes", () => this.activateSidebar());
    this.addSettingTab(new MeetingNotesSettingTab(this.app, this));
  }
  async activateSidebar() {
    var _a;
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(MEETING_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = (_a = workspace.getRightLeaf(false)) != null ? _a : workspace.getLeaf(true);
      await leaf.setViewState({ type: MEETING_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
    await leaf.view.render();
  }
  async refreshSidebar() {
    for (const leaf of this.app.workspace.getLeavesOfType(MEETING_VIEW_TYPE)) {
      await leaf.view.render();
    }
  }
  async ensureFolder(path) {
    if (!this.app.vault.getAbstractFileByPath(path)) {
      await this.app.vault.createFolder(path);
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
