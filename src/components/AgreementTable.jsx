import { useState } from 'react'

const SORT_FIELDS = {
  title: (a, b) => a.title.localeCompare(b.title),
  year: (a, b) => b.year - a.year,
  category: (a, b) => a.category.localeCompare(b.category),
  parties: (a, b) => a.parties.length - b.parties.length,
}

export default function AgreementTable({ agreements, agencyMap, categoryColors, selected, onSelect }) {
  const [sortKey, setSortKey] = useState('year')
  const [sortDir, setSortDir] = useState(1)

  const sorted = [...agreements].sort((a, b) => sortDir * SORT_FIELDS[sortKey](a, b))

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => -d)
    else { setSortKey(key); setSortDir(1) }
  }

  const arrow = (key) => sortKey === key ? (sortDir === 1 ? ' ↑' : ' ↓') : ''

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th onClick={() => handleSort('title')}>Title{arrow('title')}</th>
            <th onClick={() => handleSort('parties')}>Parties{arrow('parties')}</th>
            <th onClick={() => handleSort('year')}>Year{arrow('year')}</th>
            <th onClick={() => handleSort('category')}>Category{arrow('category')}</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(a => (
            <tr
              key={a.id}
              className={selected?.id === a.id ? 'selected' : ''}
              onClick={() => onSelect(a)}
            >
              <td style={{ maxWidth: 300 }}>{a.title}</td>
              <td>
                <div className="td-parties">
                  {a.parties.map(p => (
                    <span key={p} className="party-tag" title={agencyMap[p]?.name}>
                      {p}
                    </span>
                  ))}
                </div>
              </td>
              <td>{a.year}</td>
              <td>
                <span
                  className="category-badge"
                  style={{
                    background: (categoryColors[a.category] ?? '#4a5568') + '22',
                    color: categoryColors[a.category] ?? '#8896a8',
                  }}
                >
                  {a.category}
                </span>
              </td>
              <td>
                <span className={`source-badge source-${a.data_source}`}>
                  {a.data_source}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {agreements.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#4a5568' }}>
          No agreements match the current filters.
        </div>
      )}
    </div>
  )
}
