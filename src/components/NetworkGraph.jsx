import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import { DATA_TYPE_DOMAIN, DOMAIN_COLORS } from '../data/dataTypes'

function dominantDomain(agreements) {
  const freq = {}
  agreements.forEach(a =>
    (a.dataTypes ?? []).forEach(dt => {
      const d = DATA_TYPE_DOMAIN[dt] ?? 'Administrative'
      freq[d] = (freq[d] || 0) + 1
    })
  )
  const entries = Object.entries(freq)
  if (!entries.length) return 'Administrative'
  return entries.sort((a, b) => b[1] - a[1])[0][0]
}

export default function NetworkGraph({ agreements, agencyMap, categoryColors, selected, onSelect }) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const linkSelRef = useRef(null)
  const selectedRef = useRef(selected)
  const [tooltip, setTooltip] = useState(null)
  const [edgeMenu, setEdgeMenu] = useState(null)
  const [activeDomains, setActiveDomains] = useState(new Set())

  // Domains present in the current filtered agreements
  const presentDomains = useMemo(() => {
    const s = new Set()
    agreements.forEach(a =>
      (a.dataTypes ?? []).forEach(dt => s.add(DATA_TYPE_DOMAIN[dt] ?? 'Administrative'))
    )
    return [...s].sort()
  }, [agreements])

  // Clear active domains that no longer exist in filtered data
  useEffect(() => {
    setActiveDomains(prev => {
      const next = new Set([...prev].filter(d => presentDomains.includes(d)))
      return next.size === prev.size ? prev : next
    })
  }, [presentDomains])

  useEffect(() => { selectedRef.current = selected }, [selected])

  // Re-style edges when selection or domain filter changes — no sim restart
  useEffect(() => {
    if (!linkSelRef.current) return
    const sel = selected
    const hasDomainFilter = activeDomains.size > 0

    linkSelRef.current
      .attr('stroke', d =>
        sel && d.agreements.some(a => a.id === sel.id) ? '#e2e8f0' : d.domainColor
      )
      .attr('stroke-opacity', d => {
        const domainMatch = !hasDomainFilter || activeDomains.has(d.domain)
        const selMatch = !sel || d.agreements.some(a => a.id === sel.id)
        if (sel && selMatch) return 1
        if (sel && !selMatch) return domainMatch ? 0.18 : 0.08
        return domainMatch ? 0.75 : 0.1
      })
      .attr('stroke-width', d => {
        const active = sel && d.agreements.some(a => a.id === sel.id)
        return active ? d.baseWidth + 2 : d.baseWidth
      })
  }, [selected, activeDomains])

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    const agencySet = new Set()
    agreements.forEach(a => a.parties.forEach(p => agencySet.add(p)))

    const nodes = [...agencySet].map(id => ({
      id,
      name: agencyMap[id]?.name ?? id,
      agreements: agreements.filter(a => a.parties.includes(id)),
    }))

    const edgeMap = new Map()
    agreements.forEach(a => {
      for (let i = 0; i < a.parties.length; i++) {
        for (let j = i + 1; j < a.parties.length; j++) {
          const key = [a.parties[i], a.parties[j]].sort().join('||')
          if (!edgeMap.has(key)) edgeMap.set(key, { source: a.parties[i], target: a.parties[j], agreements: [] })
          edgeMap.get(key).agreements.push(a)
        }
      }
    })
    const links = [...edgeMap.values()]

    const maxDegree = Math.max(...nodes.map(n => n.agreements.length), 1)
    const nodeRadius = d3.scaleSqrt().domain([0, maxDegree]).range([8, 28])
    const maxEdge = Math.max(...links.map(l => l.agreements.length), 1)
    const edgeWidth = d3.scaleLinear().domain([1, maxEdge]).range([1.5, 6])

    links.forEach(l => {
      l.baseWidth = edgeWidth(l.agreements.length)
      l.domain = dominantDomain(l.agreements)
      l.domainColor = DOMAIN_COLORS[l.domain] ?? '#4a5568'
    })

    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)

    const g = svg.append('g')
    svg.call(d3.zoom().scaleExtent([0.3, 4]).on('zoom', e => g.attr('transform', e.transform)))
    svg.on('click', () => setEdgeMenu(null))

    const nodeColor = node => {
      if (!node.agreements.length) return '#4a5568'
      const freq = {}
      node.agreements.forEach(a => { freq[a.category] = (freq[a.category] || 0) + 1 })
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]
      return categoryColors[top] ?? '#4a5568'
    }

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id)
        .distance(d => 80 + nodeRadius(d.source.agreements?.length ?? 0) + nodeRadius(d.target.agreements?.length ?? 0)))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(d => d.agreements.length <= 2 ? 0.08 : 0.01))
      .force('y', d3.forceY(height / 2).strength(d => d.agreements.length <= 2 ? 0.08 : 0.01))
      .force('collide', d3.forceCollide().radius(d => nodeRadius(d.agreements.length) + 10))

    const hasDomainFilter = activeDomains.size > 0
    const sel = selectedRef.current

    const link = g.append('g').selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => sel && d.agreements.some(a => a.id === sel.id) ? '#e2e8f0' : d.domainColor)
      .attr('stroke-opacity', d => {
        const domainMatch = !hasDomainFilter || activeDomains.has(d.domain)
        const selMatch = !sel || d.agreements.some(a => a.id === sel.id)
        if (sel && selMatch) return 1
        if (sel && !selMatch) return domainMatch ? 0.18 : 0.08
        return domainMatch ? 0.75 : 0.1
      })
      .attr('stroke-width', d => d.baseWidth)
      .attr('stroke-linecap', 'round')
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const isSel = selectedRef.current && d.agreements.some(a => a.id === selectedRef.current.id)
        if (!isSel) d3.select(event.currentTarget).attr('stroke', '#e2e8f0').attr('stroke-opacity', 0.9)
        setTooltip({
          x: event.clientX - container.getBoundingClientRect().left,
          y: event.clientY - container.getBoundingClientRect().top,
          content: `${d.source.id} ↔ ${d.target.id}\n${d.agreements.length} agreement${d.agreements.length !== 1 ? 's' : ''}\n${d.domain}`,
        })
      })
      .on('mousemove', event => {
        setTooltip(t => t ? { ...t,
          x: event.clientX - container.getBoundingClientRect().left,
          y: event.clientY - container.getBoundingClientRect().top,
        } : null)
      })
      .on('mouseleave', (event, d) => {
        const isSel = selectedRef.current && d.agreements.some(a => a.id === selectedRef.current.id)
        const domainMatch = activeDomains.size === 0 || activeDomains.has(d.domain)
        d3.select(event.currentTarget)
          .attr('stroke', isSel ? '#e2e8f0' : d.domainColor)
          .attr('stroke-opacity', isSel ? 1 : (domainMatch ? 0.75 : 0.1))
        setTooltip(null)
      })
      .on('click', (event, d) => {
        event.stopPropagation()
        setTooltip(null)
        if (d.agreements.length === 1) {
          onSelect(d.agreements[0])
          setEdgeMenu(null)
        } else {
          setEdgeMenu({
            x: event.clientX - container.getBoundingClientRect().left,
            y: event.clientY - container.getBoundingClientRect().top,
            agreements: d.agreements,
          })
        }
      })

    linkSelRef.current = link

    const node = g.append('g').selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
      )

    node.append('circle')
      .attr('r', d => nodeRadius(d.agreements.length))
      .attr('fill', d => nodeColor(d))
      .attr('fill-opacity', 0.85)
      .attr('stroke', d => nodeColor(d))
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.5)
      .on('mouseenter', (event, d) => {
        d3.select(event.currentTarget).attr('fill-opacity', 1).attr('stroke-width', 2.5)
        setTooltip({
          x: event.clientX - container.getBoundingClientRect().left,
          y: event.clientY - container.getBoundingClientRect().top,
          content: `${d.id}\n${d.name}\n${d.agreements.length} agreement${d.agreements.length !== 1 ? 's' : ''}`,
        })
      })
      .on('mousemove', event => {
        setTooltip(t => t ? { ...t,
          x: event.clientX - container.getBoundingClientRect().left,
          y: event.clientY - container.getBoundingClientRect().top,
        } : null)
      })
      .on('mouseleave', event => {
        d3.select(event.currentTarget).attr('fill-opacity', 0.85).attr('stroke-width', 1.5)
        setTooltip(null)
      })
      .on('click', (event, d) => {
        event.stopPropagation()
        setEdgeMenu(null)
        if (d.agreements.length > 0) onSelect(d.agreements[0])
      })

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', d => nodeRadius(d.agreements.length) + 13)
      .attr('font-size', 11)
      .attr('font-weight', '600')
      .attr('fill', '#8896a8')
      .attr('pointer-events', 'none')
      .text(d => d.id)

    sim.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    return () => { sim.stop() }
  }, [agreements, agencyMap, categoryColors])

  const toggleDomain = domain => {
    setActiveDomains(prev => {
      const next = new Set(prev)
      next.has(domain) ? next.delete(domain) : next.add(domain)
      return next
    })
  }

  const activeCategories = [...new Set(agreements.map(a => a.category))].sort()

  return (
    <div className="network-container" ref={containerRef}>
      <svg ref={svgRef} />

      {/* Data-domain edge filter — floats top-left */}
      {presentDomains.length > 0 && (
        <div style={{
          position: 'absolute', top: 12, left: 12,
          background: 'rgba(22,27,39,0.92)', border: '1px solid #2a3348',
          borderRadius: 8, padding: '8px 10px', maxWidth: 220,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#4a5568', marginBottom: 7 }}>
            Filter edges by data domain
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {presentDomains.map(domain => {
              const color = DOMAIN_COLORS[domain] ?? '#4a5568'
              const active = activeDomains.has(domain)
              return (
                <button
                  key={domain}
                  onClick={() => toggleDomain(domain)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: active ? color + '33' : 'transparent',
                    border: `1px solid ${active ? color : '#2a3348'}`,
                    borderRadius: 100, padding: '3px 8px 3px 6px',
                    cursor: 'pointer', fontSize: 11, color: active ? '#e2e8f0' : '#64748b',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  {domain}
                </button>
              )
            })}
          </div>
          {activeDomains.size > 0 && (
            <button
              onClick={() => setActiveDomains(new Set())}
              style={{ marginTop: 6, background: 'none', border: 'none', color: '#4a5568', fontSize: 11, cursor: 'pointer', padding: 0 }}
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {tooltip && (
        <div style={{
          position: 'absolute', left: tooltip.x + 12, top: tooltip.y - 8,
          background: '#161b27', border: '1px solid #2a3348', borderRadius: 6,
          padding: '6px 10px', fontSize: 12, color: '#e2e8f0',
          pointerEvents: 'none', whiteSpace: 'pre-line', zIndex: 10,
          lineHeight: 1.5, maxWidth: 220,
        }}>
          {tooltip.content}
        </div>
      )}

      {edgeMenu && (
        <div
          style={{
            position: 'absolute', left: edgeMenu.x + 8, top: edgeMenu.y - 8,
            background: '#161b27', border: '1px solid #2a3348', borderRadius: 8,
            padding: '6px 0', fontSize: 12, color: '#e2e8f0', zIndex: 20,
            minWidth: 220, maxWidth: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: '4px 12px 8px', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {edgeMenu.agreements.length} agreements
          </div>
          {edgeMenu.agreements.map(a => (
            <div
              key={a.id}
              style={{ padding: '7px 12px', cursor: 'pointer', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1e2535'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              onClick={() => { onSelect(a); setEdgeMenu(null) }}
            >
              <div style={{ fontWeight: 500, marginBottom: 2 }}>{a.title}</div>
              <div style={{ color: '#64748b', fontSize: 11 }}>{a.year}</div>
            </div>
          ))}
        </div>
      )}

      <div className="network-hint">
        Drag nodes · Scroll to zoom · Click node or edge for details
      </div>

      {/* Legend: edges by domain + nodes by category */}
      <div className="network-legend">
        <h4>Edges — data domain</h4>
        {presentDomains.map(d => (
          <div key={d} className="legend-item">
            <div style={{ width: 18, height: 3, borderRadius: 2, background: DOMAIN_COLORS[d] ?? '#4a5568', flexShrink: 0 }} />
            {d}
          </div>
        ))}
        {activeCategories.length > 0 && (
          <>
            <h4 style={{ marginTop: 10 }}>Nodes — category</h4>
            {activeCategories.map(cat => (
              <div key={cat} className="legend-item">
                <div className="legend-dot" style={{ background: categoryColors[cat] ?? '#4a5568' }} />
                {cat}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
