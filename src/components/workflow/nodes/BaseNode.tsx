import { Handle, NodeProps, Position, useReactFlow } from "reactflow";
import { DialogProps, NodeData } from "./types";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListChecks, Settings2 } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";

export const BaseNode = (
  { data, Dialog, children, selected, Icon }: React.PropsWithChildren<NodeProps<NodeData> & {
    Dialog?: React.FC<DialogProps>
    Icon: typeof ListChecks
  }>) => {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const { setNodes } = useReactFlow();
  const handleSave = (updates: NodeData) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === data.id ? { ...node, data: updates } : node
      )
    );
  };

  return (
    <>
      <Card
        className={cn(
          'w-[300px] px-4 py-2 shadow-md rounded-lg bg-background border-2 border-border',
          selected && 'ring-2 ring-ring ring-offset-2',
        )}
        onDoubleClick={() => setDialogOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
          <div className="flex gap-2 items-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-medium">{data.name}</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setDialogOpen(true)}>
            <Settings2 className="h-4 w-4" />
          </Button>
        </CardHeader>

        <div className="p-4 pt-0">
          {data.description && (
            <p className="text-sm text-muted-foreground mb-4">{data.description}</p>
          )}

          <div className="space-y-2">
            {children}
          </div>
        </div>

        <Handle
          type="target"
          position={Position.Left}
          id={`${data.name}-input`}
          className="!bg-muted-foreground"
        />
        {data.events.map((e, index) => {
          const position = data.events.length === 1 
            ? '50%' 
            : `${(index * 100) / (data.events.length - 1)}%`;
          return (
            <div 
              key={`${data.name}-${e.name}`}
              className="absolute right-0 flex items-center"
              style={{ top: position, transform: 'translateY(-50%)' }}
            >
              <span className="text-xs text-muted-foreground mr-2">{e.name}</span>
              <Handle 
                type="source" 
                position={Position.Right} 
                id={`${data.name}-${e.name}`}
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
