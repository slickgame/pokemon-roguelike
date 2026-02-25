import React from "react";
import NodeIcon, { getNodeConfig } from "./NodeIcon";

// Visual linear map of all nodes, grouped by layer
export default function RouteMapView({ graph, currentNodeId, completedNodeIds, availableNodeIds }) {
  if (!graph) return null;

  const completed = new Set(completedNodeIds ?? []);
  const available = new Set(availableNodeIds ?? []);

  // Group by layer
  const layerMap = {};
  for (const node of graph.nodes) {
    if (!layerMap[node.layer]) layerMap[node.layer] = [];
    layerMap[node.layer].push(node);
  }
  const layers = Object.keys(layerMap).map(Number).sort((a, b) => a - b);

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max px-2 py-3">
        {layers.map((layerIdx, li) => {
          const layerNodes = layerMap[layerIdx];
          const isLast = li === layers.length - 1;

          return (
            <React.Fragment key={layerIdx}>
              {/* Layer column */}
              <div className="flex flex-col items-center gap-1.5">
                {layerNodes.map(node => {
                  const isActive = node.id === currentNodeId;
                  const isDone = completed.has(node.id);
                  const isAvail = available.has(node.id);

                  return (
                    <div key={node.id} className="flex flex-col items-center">
                      <div className={`
                        relative rounded-xl transition-all
                        ${isActive ? "scale-110" : ""}
                      `}>
                        <NodeIcon
                          type={node.type}
                          tier={node.tier}
                          size="sm"
                          completed={isDone}
                          active={isActive}
                          available={isAvail}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Arrow between layers */}
              {!isLast && (
                <div className="flex flex-col items-center justify-center gap-1.5">
                  {layerNodes.map((node, i) => (
                    <div key={i} className="h-4 flex items-center">
                      <div className="w-4 h-px bg-white/15" />
                      <div className="w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[4px] border-l-white/15" />
                    </div>
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}