export default function InquiryCard({ record, statuses, disabled, onEdit, onDelete, onStatus }) {
  return (
    <article className="inquiry">
      <div className="inquiry-content">
        <p className="customer">{record.customer}</p>
        <h2>{record.title}</h2>
        {record.details && <p className="details">{record.details}</p>}
      </div>
      <div className="actions">
        <label>
          <span className="sr-only">{record.title} 처리 상태</span>
          <select className={'status ' + record.status} value={record.status} disabled={disabled}
            onChange={(event) => onStatus(event.target.value)}>
            {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button disabled={disabled} onClick={onEdit}>수정</button>
        <button className="danger" disabled={disabled} onClick={onDelete}>삭제</button>
      </div>
    </article>
  )
}
