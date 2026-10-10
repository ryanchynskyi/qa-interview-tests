export function Placeholder({ title }: { title: string }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p className="note">Цей розділ переноситься з legacy-версії в M3.</p>
    </div>
  );
}
