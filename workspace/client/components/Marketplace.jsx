'use client';

import McpConnections from './McpConnections';
import React, { useEffect, useState } from 'react';
import {
  FiAlertCircle,
  FiCheck,
  FiExternalLink,
  FiRefreshCw,
  FiSearch,
  FiSettings,
  FiZap,
} from 'react-icons/fi';
import {
  desktopService,
  authorizeConnector,
  disconnectConnector,
  fetchConnectionStatus,
  fetchConnectorCatalog,
} from '../lib/api';

// A stable fallback keeps the marketplace useful when the API or connector key
// is not configured yet.
const CURATED_APPS = [
  { slug: 'github', label: 'GitHub', blurb: 'Issues, pull requests, and code', domain: 'github.com' },
  { slug: 'slack', label: 'Slack', blurb: 'Post updates and read channels', domain: 'slack.com' },
  { slug: 'gmail', label: 'Gmail', blurb: 'Read and send email', domain: 'gmail.com' },
  { slug: 'googlecalendar', label: 'Google Calendar', blurb: 'Read and create calendar events', domain: 'calendar.google.com' },
  { slug: 'googlesheets', label: 'Google Sheets', blurb: 'Read and update spreadsheets', domain: 'sheets.google.com' },
  { slug: 'googledocs', label: 'Google Docs', blurb: 'Read and write documents', domain: 'docs.google.com' },
  { slug: 'googledrive', label: 'Google Drive', blurb: 'Browse and manage files', domain: 'drive.google.com' },
  { slug: 'notion', label: 'Notion', blurb: 'Pages and databases', domain: 'notion.so' },
  { slug: 'linear', label: 'Linear', blurb: 'Issues and project tracking', domain: 'linear.app' },
  { slug: 'discord', label: 'Discord', blurb: 'Messages and channels', domain: 'discord.com' },
  { slug: 'x', label: 'X (Twitter)', blurb: 'Post and read on X', domain: 'x.com' },
  { slug: 'hubspot', label: 'HubSpot', blurb: 'CRM search and updates', domain: 'hubspot.com' },
  { slug: 'salesforce', label: 'Salesforce', blurb: 'CRM records and reports', domain: 'salesforce.com' },
  { slug: 'jira', label: 'Jira', blurb: 'Issues and sprints', domain: 'atlassian.com' },
  { slug: 'asana', label: 'Asana', blurb: 'Tasks and projects', domain: 'asana.com' },
  { slug: 'trello', label: 'Trello', blurb: 'Boards and cards', domain: 'trello.com' },
  { slug: 'dropbox', label: 'Dropbox', blurb: 'Files and folders', domain: 'dropbox.com' },
  { slug: 'airtable', label: 'Airtable', blurb: 'Bases and records', domain: 'airtable.com' },
  { slug: 'figma', label: 'Figma', blurb: 'Files and comments', domain: 'figma.com' },
  { slug: 'stripe', label: 'Stripe', blurb: 'Payments and customers', domain: 'stripe.com' },
  { slug: 'zapier', label: 'Zapier', blurb: 'Connect apps through automation', domain: 'zapier.com' },
  { slug: 'reddit', label: 'Reddit', blurb: 'Browse and post on Reddit', domain: 'reddit.com' },
  { slug: 'sentry', label: 'Sentry', blurb: 'Errors, alerts, and performance', domain: 'sentry.io' },
  { slug: 'posthog', label: 'PostHog', blurb: 'Analytics and feature flags', domain: 'posthog.com' },
];

const LS_KEY = 'open_dots_connected_plugins';

function loadLocalEnabled() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalEnabled(slugs) {
  localStorage.setItem(LS_KEY, JSON.stringify(slugs));
}

function normalizeCard(app) {
  return {
    slug: app.slug || app.key || app.name,
    label: app.label || app.name || app.slug,
    blurb: app.blurb || app.description || 'Connector integration',
    domain: app.domain || '',
    logo: app.logo || null,
  };
}

function AppIcon({ app }) {
  const [failed, setFailed] = useState(false);
  const source = app.logo || (app.domain
    ? `https://www.google.com/s2/favicons?domain=${app.domain}&sz=64`
    : null);

  if (source && !failed) {
    return (
      <img
        src={source}
        alt=""
        className="w-8 h-8 rounded-lg object-contain flex-shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-lg bg-[#eadbc7] flex items-center justify-center text-xs font-bold text-zinc-300 border border-[#dfcdb5] flex-shrink-0">
      {(app.label || '?').charAt(0).toUpperCase()}
    </div>
  );
}

export default function Marketplace({ onOpenSettings }) {
  const [apps, setApps] = useState(CURATED_APPS);
  const [connected, setConnected] = useState([]);
  const [search, setSearch] = useState('');
  const [configured, setConfigured] = useState(false);
  const [source, setSource] = useState('curated');
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadMarketplace() {
      setLoading(true);
      setError('');

      const catalog = await fetchConnectorCatalog();
      const nextApps = (catalog.cards || []).length
        ? catalog.cards.map(normalizeCard)
        : CURATED_APPS;

      if (!mounted) return;
      setApps(nextApps);
      setConfigured(Boolean(catalog.configured));
      setSource(catalog.source || 'curated');

      if (catalog.configured && nextApps.length) {
        const status = await fetchConnectionStatus(nextApps.map((app) => app.slug));
        if (!mounted) return;
        setConnected(
          Object.entries(status.services || {})
            .filter(([, value]) => value && value.connected)
            .map(([slug]) => slug),
        );
        if (status.error) setError(status.error);
      } else {
        setConnected([]);
      }

      if (mounted) setLoading(false);
    }

    loadMarketplace().catch((err) => {
      if (!mounted) return;
      setError(err.message || 'Could not load connector catalog');
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [refreshToken]);

  const toggle = async (app) => {
    if (busySlug) return;
    setNotice('');
    setError('');

    const isOn = connected.includes(app.slug);
    if (!configured) {
      onOpenSettings?.();
      setNotice('Add a Composio key in Settings, or connect your own MCP server above.');
      return;
    }

    setBusySlug(app.slug);
    let authWindow = null;
    try {


      if (isOn) {
        await disconnectConnector(app.slug);
        setConnected((current) => current.filter((slug) => slug !== app.slug));
        setNotice(`${app.label} disconnected.`);
      } else {
        const result = await authorizeConnector(app.slug);
        if (!result.url) throw new Error('The connector did not return an authorization link');
        await desktopService('open-auth', {url: result.url});
        setNotice(`Authorization opened for ${app.label}. Refresh after completing it.`);
      }
    } catch (err) {
      if (authWindow && !authWindow.closed) authWindow.close();
      setError(err.message || `Could not update ${app.label}`);
    } finally {
      setBusySlug(null);
    }
  };

  const visible = apps.filter((app) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return `${app.label} ${app.slug} ${app.blurb}`.toLowerCase().includes(query);
  });

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#faf6ee] select-none font-sans text-zinc-100">
      <div className="px-6 py-4 border-b border-[#18181c] flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-zinc-100 tracking-wide">Plugins & connections</h2>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-1.5 py-0.5 rounded-full font-semibold">
              {connected.length} Composio apps
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Your MCP servers and optional app accounts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRefreshToken((value) => value + 1)}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-[#f3e8d7] transition"
            title="Refresh connector status"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="relative w-56">
            <FiSearch className="absolute left-3 top-2.5 text-zinc-500 text-xs" />
            <input
              suppressHydrationWarning={true}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search apps…"
              className="w-full bg-[#fffdf8] border border-[#eadbc7] rounded-xl pl-8 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition"
            />
          </div>
        </div>
      </div>

      <div className="mx-6 mt-4 flex-shrink-0">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.07] px-4 py-2.5 text-[11px] text-[#79563c] flex items-start gap-2">
          <FiZap className="flex-shrink-0 text-blue-400 mt-0.5" />
          <span>
            {configured
              ? 'Connect an app to open its provider authorization flow. No account is connected until you complete that flow.'
              : 'For additional apps below, add a Composio API key in Settings. Your MCP connections work independently.'}
          </span>
          {!configured && onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="ml-auto flex items-center gap-1 text-[#79563c] hover:text-white font-semibold flex-shrink-0"
            >
              <FiSettings /> Settings
            </button>
          )}
        </div>
      </div>

      {(notice || error) && (
        <div className={`mx-6 mt-3 flex-shrink-0 rounded-xl border px-4 py-2.5 text-[11px] flex items-start gap-2 ${
          error
            ? 'border-rose-500/20 bg-rose-500/[0.07] text-rose-300'
            : 'border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300'
        }`}>
          {error ? <FiAlertCircle className="mt-0.5 flex-shrink-0" /> : <FiCheck className="mt-0.5 flex-shrink-0" />}
          <span>{error || notice}</span>
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto mx-6 mt-3 mb-6 rounded-2xl border border-[#f3e8d7]"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#eadbc7 transparent' }}
      >
        <McpConnections />
        <h2 className="font-semibold p-4">More apps · Composio</h2>
        {loading && apps.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-600">Loading connectors…</div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-600">No apps match.</div>
        ) : (
          visible.map((app, index) => {
            const isOn = connected.includes(app.slug);
            const isBusy = busySlug === app.slug;
            return (
              <div
                key={app.slug}
                className={`flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-[#fffdf8] ${
                  index > 0 ? 'border-t border-[#f3eadc]' : ''
                } ${isOn ? 'bg-[#e8eedf]' : 'bg-[#faf6ee]'}`}
              >
                <AppIcon app={app} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
                    {app.label}
                    {isOn && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block flex-shrink-0" />}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate mt-0.5">{app.blurb}</div>
                </div>

                <button
                  suppressHydrationWarning={true}
                  type="button"
                  disabled={Boolean(busySlug)}
                  onClick={() => toggle(app)}
                  className={`w-28 flex-shrink-0 py-1.5 rounded-xl text-[11px] font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                    isOn
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/40 hover:bg-rose-500/15 hover:text-rose-400 hover:border-rose-500/30'
                      : 'bg-[#f3e8d7] text-zinc-400 border border-[#eadbc7] hover:text-white hover:bg-[#eadbc7]'
                  }`}
                >
                  {isBusy ? (
                    <FiRefreshCw className="animate-spin" />
                  ) : isOn ? (
                    <>
                      <FiCheck className="text-xs" />
                      {configured ? 'Connected' : 'Enabled'}
                    </>
                  ) : (
                    <>
                      {configured && <FiExternalLink className="text-xs" />}
                      {configured ? 'Connect' : 'Set up'}
                    </>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
