import { CATEGORY_COLORS } from '../App'
import { DOMAIN_COLORS, DATA_TYPE_DOMAIN } from '../data/dataTypes'

export default function AgreementDetail({ agreement: a, agencyMap, onClose }) {
  const color = CATEGORY_COLORS[a.category] ?? '#4a5568'

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <h3>{a.title}</h3>
        <button className="detail-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="detail-body">
        <div className="detail-field">
          <span className="detail-label">Category</span>
          <span
            className="category-badge"
            style={{ background: color + '22', color, alignSelf: 'flex-start' }}
          >
            {a.category}
          </span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Parties</span>
          <div className="detail-parties">
            {a.parties.map(id => (
              <div key={id} className="detail-party">
                <strong>{id}</strong>
                <span>{agencyMap[id]?.name ?? id}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="detail-field">
          <span className="detail-label">Date</span>
          <span className="detail-value">
            {a.date
              ? new Date(a.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
              : 'Unknown'}
          </span>
        </div>

        {a.dataTypes?.length > 0 && (
          <div className="detail-field">
            <span className="detail-label">Data Shared</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {a.dataTypes.map(dt => {
                const domainColor = DOMAIN_COLORS[DATA_TYPE_DOMAIN[dt]] ?? '#64748b'
                return (
                  <span
                    key={dt}
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: domainColor + '22',
                      color: domainColor,
                      border: `1px solid ${domainColor}44`,
                      fontWeight: 500,
                    }}
                  >
                    {dt}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        <div className="detail-field">
          <span className="detail-label">Description</span>
          <span className="detail-value">{a.description}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Data Source</span>
          <span className="detail-value">
            <span className={`source-badge source-${a.data_source}`}>{a.data_source}</span>
            {a.data_source === 'scraped' && (
              <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>
                Extracted from agency MOU page — links to published PDF
              </span>
            )}
          </span>
        </div>

        {(a.pdfUrl || a.sourceUrl) && (
          <div className="detail-field">
            <span className="detail-label">Links</span>
            <div className="detail-links">
              {a.pdfUrl && (
                <a className="detail-link" href={a.pdfUrl} target="_blank" rel="noreferrer">
                  <span>📄</span> View PDF Agreement
                </a>
              )}
              {a.sourceUrl && (
                <a className="detail-link" href={a.sourceUrl} target="_blank" rel="noreferrer">
                  <span>🏛</span> Agency MOU Page
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
