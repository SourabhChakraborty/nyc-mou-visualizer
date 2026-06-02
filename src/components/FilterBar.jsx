export default function FilterBar({ filters, onChange, agencies, categories }) {
  const update = (patch) => onChange({ ...filters, ...patch })

  const toggleAgency = (id) => {
    const next = filters.agencies.includes(id)
      ? filters.agencies.filter(a => a !== id)
      : [...filters.agencies, id]
    update({ agencies: next })
  }

  const toggleCategory = (cat) => {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter(c => c !== cat)
      : [...filters.categories, cat]
    update({ categories: next })
  }

  const hasActive =
    filters.agencies.length ||
    filters.categories.length ||
    filters.search ||
    filters.dataSource !== 'all' ||
    filters.yearRange[0] !== 2015 ||
    filters.yearRange[1] !== 2025

  const clearAll = () =>
    onChange({ agencies: [], categories: [], yearRange: [2015, 2025], search: '', dataSource: 'all' })

  return (
    <div className="filter-bar">
      <input
        className="filter-input"
        type="text"
        placeholder="Search title, agency, category…"
        value={filters.search}
        onChange={e => update({ search: e.target.value })}
      />

      <select
        className="filter-select"
        value=""
        onChange={e => { if (e.target.value) toggleAgency(e.target.value) }}
      >
        <option value="">+ Agency</option>
        {agencies
          .filter(a => !filters.agencies.includes(a.id))
          .map(a => (
            <option key={a.id} value={a.id}>{a.id} — {a.name}</option>
          ))}
      </select>

      <select
        className="filter-select"
        value=""
        onChange={e => { if (e.target.value) toggleCategory(e.target.value) }}
      >
        <option value="">+ Category</option>
        {categories
          .filter(c => !filters.categories.includes(c))
          .map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      <select
        className="filter-select"
        value={filters.dataSource}
        onChange={e => update({ dataSource: e.target.value })}
      >
        <option value="all">All sources</option>
        <option value="confirmed">Confirmed only</option>
        <option value="seeded">Seeded only</option>
      </select>

      <div className="year-range">
        <span>{filters.yearRange[0]}</span>
        <input
          type="range" min={2015} max={2025}
          value={filters.yearRange[0]}
          onChange={e => {
            const v = +e.target.value
            if (v <= filters.yearRange[1]) update({ yearRange: [v, filters.yearRange[1]] })
          }}
        />
        <span>–</span>
        <input
          type="range" min={2015} max={2025}
          value={filters.yearRange[1]}
          onChange={e => {
            const v = +e.target.value
            if (v >= filters.yearRange[0]) update({ yearRange: [filters.yearRange[0], v] })
          }}
        />
        <span>{filters.yearRange[1]}</span>
      </div>

      {(filters.agencies.length > 0 || filters.categories.length > 0) && (
        <div className="filter-pills">
          {filters.agencies.map(id => (
            <span key={id} className="filter-pill">
              {id}
              <button onClick={() => toggleAgency(id)}>×</button>
            </span>
          ))}
          {filters.categories.map(cat => (
            <span key={cat} className="filter-pill">
              {cat}
              <button onClick={() => toggleCategory(cat)}>×</button>
            </span>
          ))}
        </div>
      )}

      {hasActive && (
        <button className="filter-clear" onClick={clearAll}>Clear all</button>
      )}
    </div>
  )
}
