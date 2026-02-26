import { useEffect, useMemo, useState } from "react";
import { rpcWithArgFallback, supabase } from "../../lib/supabase";

const defaultSettings = {
  league_size: 20,
  promote_count: 3,
  demote_count: 3,
  enabled: true
};

const formatPoints = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

const tierLabel = (row) => row?.league_name || `League ${row?.league_tier || 1}`;

export default function ManageLeagues() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [rows, setRows] = useState([]);
  const [week, setWeek] = useState({ week_start: null, week_end: null });
  const [settings, setSettings] = useState(defaultSettings);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    const refreshRes = await rpcWithArgFallback("league_refresh_current_scores", [{}, {}]);
    if (refreshRes.error) {
      setLoading(false);
      setError(refreshRes.error.message || "Failed to refresh league scores.");
      return;
    }

    const [settingsRes, rowsRes] = await Promise.all([
      supabase
        .from("league_settings")
        .select("league_size,promote_count,demote_count,enabled")
        .eq("id", 1)
        .maybeSingle(),
      rpcWithArgFallback("admin_get_league_week_rows", [{}, {}])
    ]);

    setLoading(false);

    if (settingsRes.error) {
      setError(settingsRes.error.message || "Failed to load league settings.");
      return;
    }
    if (rowsRes.error) {
      setError(rowsRes.error.message || "Failed to load league rows.");
      return;
    }

    const settingsRow = settingsRes.data || defaultSettings;
    setSettings({
      league_size: Number(settingsRow.league_size || defaultSettings.league_size),
      promote_count: Number(settingsRow.promote_count || defaultSettings.promote_count),
      demote_count: Number(settingsRow.demote_count || defaultSettings.demote_count),
      enabled: Boolean(settingsRow.enabled)
    });

    const data = rowsRes.data || [];
    setRows(data);
    setWeek({
      week_start: data[0]?.week_start || null,
      week_end: data[0]?.week_end || null
    });
  };

  useEffect(() => {
    load();
  }, []);

  const groupedRows = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const tier = Number(row.league_tier || 1);
      if (!map.has(tier)) map.set(tier, []);
      map.get(tier).push(row);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [rows]);

  const stats = useMemo(() => {
    const participants = rows.length;
    const leagues = groupedRows.length;
    const top = rows[0];
    return { participants, leagues, top };
  }, [rows, groupedRows]);

  const saveSettings = async () => {
    setMsg("");
    setError("");

    const leagueSize = Number(settings.league_size);
    const promoteCount = Number(settings.promote_count);
    const demoteCount = Number(settings.demote_count);

    if (!Number.isInteger(leagueSize) || leagueSize < 5) {
      setError("League size must be an integer >= 5.");
      return;
    }
    if (!Number.isInteger(promoteCount) || promoteCount < 0) {
      setError("Promote count must be an integer >= 0.");
      return;
    }
    if (!Number.isInteger(demoteCount) || demoteCount < 0) {
      setError("Demote count must be an integer >= 0.");
      return;
    }
    if (promoteCount + demoteCount >= leagueSize) {
      setError("Promote + demote must be less than league size.");
      return;
    }

    setSaving(true);
    const { error: rpcErr } = await rpcWithArgFallback("admin_update_league_settings", [
      {
        p_league_size: leagueSize,
        p_promote_count: promoteCount,
        p_demote_count: demoteCount,
        p_enabled: Boolean(settings.enabled)
      },
      {
        league_size: leagueSize,
        promote_count: promoteCount,
        demote_count: demoteCount,
        enabled: Boolean(settings.enabled)
      }
    ]);
    setSaving(false);

    if (rpcErr) {
      setError(rpcErr.message || "Failed to save league settings.");
      return;
    }

    setMsg("League settings updated.");
    await load();
  };

  const closeWeek = async () => {
    setMsg("");
    setError("");

    if (!window.confirm("Close current league week and start a new one?")) return;

    setClosing(true);
    const { error: rpcErr } = await rpcWithArgFallback("admin_close_league_week", [
      { p_start_next_week: true },
      { start_next_week: true },
      {}
    ]);
    setClosing(false);

    if (rpcErr) {
      setError(rpcErr.message || "Failed to close the current week.");
      return;
    }

    setMsg("Current week closed and next week opened.");
    await load();
  };

  return (
    <section className="page">
      <h1>Weekly Leagues</h1>
      <p className="muted">Admin control for weekly user competition, promotions and demotions.</p>

      <div className="grid-3">
        <div className="card">
          <h3>Participants</h3>
          <p className="big">{stats.participants}</p>
        </div>
        <div className="card">
          <h3>Leagues</h3>
          <p className="big">{stats.leagues}</p>
        </div>
        <div className="card">
          <h3>Current Top User</h3>
          <p className="big">{stats.top?.profile_name || "-"}</p>
        </div>
      </div>

      <div className="card">
        <h3>Current Week</h3>
        <p className="muted">
          {week.week_start ? `${week.week_start} to ${week.week_end}` : "No active week found."}
        </p>
        <div className="split">
          <button className="btn btn-outline" onClick={load} disabled={loading}>
            Refresh
          </button>
          <button className="btn" onClick={closeWeek} disabled={closing || !week.week_start}>
            {closing ? "Closing..." : "Close Week"}
          </button>
        </div>
      </div>

      <div className="card">
        <h3>League Settings</h3>
        <div className="grid-3">
          <label>
            Users Per League
            <input
              type="number"
              min="5"
              step="1"
              value={settings.league_size}
              onChange={(e) => setSettings((prev) => ({ ...prev, league_size: e.target.value }))}
            />
          </label>
          <label>
            Weekly Promotions
            <input
              type="number"
              min="0"
              step="1"
              value={settings.promote_count}
              onChange={(e) => setSettings((prev) => ({ ...prev, promote_count: e.target.value }))}
            />
          </label>
          <label>
            Weekly Demotions
            <input
              type="number"
              min="0"
              step="1"
              value={settings.demote_count}
              onChange={(e) => setSettings((prev) => ({ ...prev, demote_count: e.target.value }))}
            />
          </label>
        </div>

        <label className="inline-check">
          <input
            type="checkbox"
            checked={Boolean(settings.enabled)}
            onChange={(e) => setSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
          />
          Enable weekly competition
        </label>

        <button className="btn" onClick={saveSettings} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {msg ? <p className="success">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading league data...</p> : null}

      {groupedRows.map(([tier, tierRows]) => (
        <div className="card table-wrap" key={tier}>
          <h3>{tierLabel(tierRows[0])}</h3>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Weekly Points</th>
              </tr>
            </thead>
            <tbody>
              {tierRows.map((row) => (
                <tr key={row.profile_id}>
                  <td>#{row.rank || "-"}</td>
                  <td>{row.profile_name || "-"}</td>
                  <td>{row.profile_phone || "-"}</td>
                  <td>{formatPoints(row.weekly_points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {!groupedRows.length && !loading ? <p className="muted">No league rows yet.</p> : null}
    </section>
  );
}
