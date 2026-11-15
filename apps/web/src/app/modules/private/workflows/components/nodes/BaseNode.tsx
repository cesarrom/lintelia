import { Handle, NodeProps, Position } from "reactflow";
import { DialogProps } from "./types";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListChecks, Settings2 } from "lucide-react";
import React, { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useNode, useNodeData, useWorkflow } from "../WorkflowContext";
import { NodeData } from "../yaml/types";

export const BaseNode = (
  { Dialog, children, selected, Icon, noInput }: React.PropsWithChildren<NodeProps<NodeData> & {
    Dialog?: React.FC<DialogProps>
    Icon: typeof ListChecks
    noInput?: boolean
  }>) => {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [node] = useNode<NodeData>();
  const [data] = useNodeData<NodeData>();
  const { edges, updateEdges } = useWorkflow();
  const [lastLen, setLastLen] = React.useState(edges.length);

  useEffect(() => {
    if (lastLen !== edges.length) {
      updateEdges(edges);
      setLastLen(edges.length);
    }
  }, [lastLen, edges, updateEdges]);

  const handleSave = (updates: Partial<NodeData>) => {
    console.log(updates);
  };

  if (!data || !node) return null;

  return (
    <>
      <Card
        className={cn(
          'w-[300px] px-4 py-2 shadow-md rounded-lg bg-background border-2 border-border',
          selected && 'ring-2 ring-ring ring-offset-2',
        )}
        onDoubleClick={() => setDialogOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 mr-6">
          <div className="flex gap-2 items-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-medium">{data.name}</CardTitle>
          </div>
          {Dialog ? <Button variant="ghost" size="icon" onClick={() => setDialogOpen(true)}>
            <Settings2 className="h-4 w-4" />
          </Button> : null}
        </CardHeader>

        <div className="p-4 pt-0 mr-6">
          {data.description && (
            <p className="text-sm text-muted-foreground mb-4">{data.description}</p>
          )}

          <div className="space-y-2">
            {children}
          </div>
        </div>

        {noInput ? null : (
          <Handle
            type="target"
            position={Position.Left}
            id={`${node.id}-input`}
            className="!bg-muted-foreground"
          />
        )}
        {data.events.map((e, index) => {
          // Add padding of 20px from top and bottom (40px total)
          const position = data.events.length === 1
            ? '50%'
            : `${20 + (index * 60) / (data.events.length - 1)}%`;
          return (
            <div
              key={`${node.id}-${e.name}-wrapper`}
              className="absolute right-0 flex items-center"
              style={{ top: position, transform: 'translateY(-50%)' }}
            >
              <span className="text-xs text-muted-foreground mr-2">{e.name}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={`${node.id}-${e.name}`}
                className="!bg-muted-foreground"
              />
            </div>
          );
        })}
      </Card>

      {Dialog ? <Dialog open={dialogOpen} onOpenChange={setDialogOpen} data={data} onSave={handleSave} /> : null}
    </>
  )
};
