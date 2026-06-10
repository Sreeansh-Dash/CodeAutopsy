import { useState } from 'react'
import { useAnalysisStore } from '../../store/analysisStore'
import { getNodeColor } from '../../utils/graphHelpers'

/** Convert flat file list to nested tree object */
function buildTree(files) {
  const root = {}
  for (const file of files) {
    const parts = file.path.replace(/\\/g, '/').split('/')
    let cur = root
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = { _dir: true, _children: {} }
      cur = cur[parts[i]]._children
    }
    cur[parts[parts.length - 1]] = { _file: file }
  }
  return root
}

function TreeNode({ name, node, depth }) {
  const [open, setOpen] = useState(depth < 2)
  const { selectedNodeId, setSelectedNode } = useAnalysisStore()

  if (node._file) {
    const file = node._file
    const selected = selectedNodeId === file.id
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setSelectedNode(selected ? null : file.id)}
        onKeyDown={(e) => e.key === 'Enter' && setSelectedNode(selected ? null : file.id)}
        className={`flex items-center gap-1.5 py-[3px] pr-2 rounded text-xs cursor-pointer transition-colors ${
          selected
            ? 'bg-primary/15 text-foreground'
            : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: getNodeColor(file.language) }}
        />
        <span className="truncate">{name}</span>
        <span className="ml-auto text-[10px] opacity-40 tabular-nums shrink-0">
          {file.lines_of_code}L
        </span>
      </div>
    )
  }

  const children = node._children || {}
  const hasChildren = Object.keys(children).length > 0

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(!open)}
        className="flex items-center gap-1.5 py-[3px] pr-2 rounded text-xs cursor-pointer text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-colors"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="opacity-50 shrink-0 w-3 text-center">{open ? '▾' : '▸'}</span>
        <span className="truncate font-medium">{name}</span>
      </div>
      {open &&
        hasChildren &&
        Object.entries(children)
          .sort(([, a], [, b]) => (b._dir ? 1 : 0) - (a._dir ? 1 : 0)) // dirs first
          .map(([childName, childNode]) => (
            <TreeNode key={childName} name={childName} node={childNode} depth={depth + 1} />
          ))}
    </div>
  )
}

export default function FileTree({ files }) {
  const tree = buildTree(files)

  if (!files.length) {
    return (
      <div className="p-3 text-xs text-muted-foreground">No files available</div>
    )
  }

  return (
    <div className="h-full overflow-y-auto py-1.5 select-none">
      {Object.entries(tree).map(([name, node]) => (
        <TreeNode key={name} name={name} node={node} depth={0} />
      ))}
    </div>
  )
}
