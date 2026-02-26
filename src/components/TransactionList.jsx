export default function TransactionList({ rows, emptyText = "لا توجد معاملات" }) {
  if (!rows?.length) return <p className="muted">{emptyText}</p>;

  const pointClass = (value) => {
    const text = String(value ?? "");
    if (text.startsWith("-")) return "points-negative";
    if (text.startsWith("+")) return "points-positive";
    return "";
  };

  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>النوع</th>
            <th>تفاصيل</th>
            <th>النقاط</th>
            <th>التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.type}</td>
              <td>{row.details}</td>
              <td className={pointClass(row.points)}>{row.points}</td>
              <td>{new Date(row.created_at).toLocaleString("ar-EG")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
