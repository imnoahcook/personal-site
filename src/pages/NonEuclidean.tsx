import { Link } from 'react-router-dom'
import './NonEuclidean.css'

const DEMOS = [
  {
    id: 'level1',
    title: 'Level1',
    subtitle: 'Connected tunnel spaces',
    source: 'Level1.cpp',
    status: 'live',
  },
  {
    id: 'level2-3',
    title: 'Level2(3)',
    subtitle: 'Three-room house portal topology',
    source: 'Level2.cpp',
    status: 'live',
  },
  {
    id: 'level2-6',
    title: 'Level2(6)',
    subtitle: 'Two-house six-room chain',
    source: 'Level2.cpp',
    status: 'live',
  },
  {
    id: 'level3',
    title: 'Level3',
    subtitle: 'Pillar-room portal loop',
    source: 'Level3.cpp',
    status: 'stub',
  },
  {
    id: 'level4',
    title: 'Level4',
    subtitle: 'Sloped cross-connected tunnels',
    source: 'Level4.cpp',
    status: 'stub',
  },
  {
    id: 'level5',
    title: 'Level5',
    subtitle: 'Scale-change tunnel demo',
    source: 'Level5.cpp',
    status: 'stub',
  },
  {
    id: 'level6',
    title: 'Level6',
    subtitle: 'Portalized floorplan house',
    source: 'Level6.cpp',
    status: 'stub',
  },
] as const

export default function NonEuclidean() {
  return (
    <div className="non-euclidean-page non-euclidean-hub">
      <div className="non-euclidean-ui non-euclidean-ui--hub">
        <p className="non-euclidean-title">NON-EUCLIDEAN DEMOS</p>
        <p className="non-euclidean-copy">
          Route set based on the local `_context/NonEuclidean` engine. `Level1`, `Level2(3)`, and
          `Level2(6)` are live ports now; the remaining scenes are still scaffolded.
        </p>

        <div className="non-euclidean-demo-list">
          {DEMOS.map((demo) => (
            <Link key={demo.id} className="non-euclidean-demo-card" to={`/non-euclidean/${demo.id}`}>
              <span className="non-euclidean-demo-heading">{demo.title}</span>
              <span className="non-euclidean-demo-subtitle">{demo.subtitle}</span>
              <span className="non-euclidean-demo-source">{demo.source}</span>
              <span className="non-euclidean-demo-status">{demo.status}</span>
            </Link>
          ))}
        </div>

        <div className="non-euclidean-links">
          <Link to="/">home</Link>
          <Link to="/inspection">inspection</Link>
        </div>
      </div>
    </div>
  )
}
