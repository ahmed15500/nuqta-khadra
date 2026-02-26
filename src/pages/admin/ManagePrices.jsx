import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ManagePrices() {
  const [types, setTypes] = useState([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("waste_types")
      .select("id,name,icon,points_per_kg,updated_at")
      .order("name");
    setTypes(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (id, value) => {
    setMsg("");
    setError("");
    const pointsPerKg = Number(value);
    if (pointsPerKg < 0) return setError("لا يمكن وضع قيمة سالبة");

    const { error: upErr } = await supabase
      .from("waste_types")
      .update({ points_per_kg: pointsPerKg, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (upErr) return setError(upErr.message);

    setMsg("تم تحديث السعر بنجاح");
    load();
  };

  return (
    <section className="page">
      <h1>إدارة أسعار المخلفات</h1>
      {msg ? <p className="success">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>النوع</th>
              <th>نقاط/كيلو</th>
              <th>آخر تحديث</th>
              <th>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <PriceRow key={t.id} item={t} onSave={save} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PriceRow({ item, onSave }) {
  const [value, setValue] = useState(item.points_per_kg);

  return (
    <tr>
      <td>
        {item.icon} {item.name}
      </td>
      <td>
        <input type="number" step="0.1" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
      </td>
      <td>{item.updated_at ? new Date(item.updated_at).toLocaleString("ar-EG") : "-"}</td>
      <td>
        <button className="btn" onClick={() => onSave(item.id, value)}>
          حفظ
        </button>
      </td>
    </tr>
  );
}
