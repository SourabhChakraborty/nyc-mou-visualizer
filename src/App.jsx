import { useState, useMemo } from 'react'
import data from './data/agreements.json'
import NetworkGraph from './components/NetworkGraph'
import AgreementTable from './components/AgreementTable'
import AgreementDetail from './components/AgreementDetail'
import DataTypesView from './components/DataTypesView'
import FilterBar from './components/FilterBar'
import AboutView from './components/AboutView'
import './App.css'

export const CATEGORY_COLORS = {
  'Financial/Benefits':  '#6366f1',
  'Health Data':         '#ec4899',
  'Identity & Benefits': '#3b82f6',
  'Youth & Families':    '#f59e0b',
  'Criminal Justice':    '#8b5cf6',
  'Housing':             '#f97316',
  'Education':           '#22c55e',
  'Transportation':      '#14b8a6',
  'Administrative':      '#64748b',
  'Emergency Response':  '#ef4444',
}

export default function App() {
  const [view, setView] = useState('network')
  const [selected, setSelected] = useState(null)
  const [filters, setFilters] = useState({
    agencies: [],
    categories: [],
    yearRange: [2010, 2026],
    search: '',
    dataSource: 'all',
  })

  const allCategories = useMemo(
    () => [...new Set(data.agreements.map(a => a.category))].sort(),
    []
  )

  const filtered = useMemo(() => {
    return data.agreements.filter(a => {
      if (filters.agencies.length && !a.parties.some(p => filters.agencies.includes(p))) return false
      if (filters.categories.length && !filters.categories.includes(a.category)) return false
      if (a.year && (a.year < filters.yearRange[0] || a.year > filters.yearRange[1])) return false
      if (filters.dataSource === 'confirmed' && a.data_source !== 'confirmed') return false
      if (filters.dataSource === 'scraped' && a.data_source !== 'scraped') return false
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (
          !a.title.toLowerCase().includes(q) &&
          !a.description.toLowerCase().includes(q) &&
          !a.parties.some(p => p.toLowerCase().includes(q)) &&
          !a.category.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [filters])

  const agencyMap = useMemo(() => Object.fromEntries(data.agencies.map(a => [a.id, a])), [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-title">
          <h1>NYC Interagency Data Sharing Agreements</h1>
          <span className="header-subtitle">
            {filtered.length} of {data.agreements.length} agreements · {data.agencies.length} agencies · Local Law 40
          </span>
        </div>
        <div className="view-toggle">
          <button
            className={view === 'network' ? 'active' : ''}
            onClick={() => setView('network')}
          >
            Network
          </button>
          <button
            className={view === 'datatypes' ? 'active' : ''}
            onClick={() => setView('datatypes')}
          >
            Data Types
          </button>
          <button
            className={view === 'table' ? 'active' : ''}
            onClick={() => setView('table')}
          >
            Table
          </button>
          <button
            className={view === 'about' ? 'active' : ''}
            onClick={() => setView('about')}
          >
            About
          </button>
        </div>
      </header>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        agencies={data.agencies}
        categories={allCategories}
      />

      <div className="app-body">
        <div className="main-view">
          {view === 'network' && (
            <NetworkGraph
              agreements={filtered}
              agencies={data.agencies}
              agencyMap={agencyMap}
              categoryColors={CATEGORY_COLORS}
              selected={selected}
              onSelect={setSelected}
            />
          )}
          {view === 'datatypes' && (
            <DataTypesView
              agreements={filtered}
              agencyMap={agencyMap}
              onSelect={setSelected}
            />
          )}
          {view === 'table' && (
            <AgreementTable
              agreements={filtered}
              agencyMap={agencyMap}
              categoryColors={CATEGORY_COLORS}
              selected={selected}
              onSelect={setSelected}
            />
          )}
          {view === 'about' && <AboutView />}
        </div>

        {selected && (
          <AgreementDetail
            agreement={selected}
            agencyMap={agencyMap}
            categoryColors={CATEGORY_COLORS}
            onClose={() => setSelected(null)}
          />
        )}
      </div>

      <footer className="app-footer">
        <span>
          Data sourced from NYC agency MOU pages under{' '}
          <a href="https://www.nyc.gov/site/records/about/agency-mous.page" target="_blank" rel="noreferrer">
            Local Law 40 of 2011
          </a>
          . Confirmed entries are manually curated; scraped entries are extracted directly from agency MOU pages.
        </span>
        <a className="footer-link" href="https://www.nyc.gov/content/oti/pages/data-analytics/citywide-data-sharing" target="_blank" rel="noreferrer">
          NYC Citywide Data Sharing ↗
        </a>
      </footer>
    </div>
  )
}
