import "./App.css";

import { useMemo, useRef } from "react";
import * as am5 from '@amcharts/amcharts5';
import * as am5Flow from '@amcharts/amcharts5/flow';

import {
  client,
  useConfig,
  useElementData,
} from "@sigmacomputing/plugin";

client.config.configureEditorPanel([
  { name: "source", type: "element" },
  { name: "dimension", type: "column", source: "source", allowMultiple: true },
  { name: "measures", type: "column", source: "source", allowMultiple: true },
]);

function App() {
  const config = useConfig();
  const sigmaData = useElementData(config.source);
  const ref = useRef();

  const options = useMemo(() => {
    const dimensions = config.dimension;
    const measures = config.measures;

    // transform sigmaData --> sankey data
    let dataMap = [];
    if (dimensions && sigmaData?.[dimensions[0]]) {
      for (let i = 0; i < dimensions.length - 1; i++) {
        for (let j = 0; j < sigmaData[dimensions[i]].length; j++) {
          const from = sigmaData[dimensions[i]][j];
          const to = sigmaData[dimensions[i + 1]][j];
          const weight = sigmaData[measures[i]][j];
          const dataPoint = [from, to, weight];
          dataMap[dataPoint] = dataPoint;
        }
      }
      let data = [];
      let i = 0;
      for (var key in dataMap) {
        data[i] = dataMap[key];
        i++;
      }

      let root = am5.Root.new("chartdiv");
      let series = root.container.children.push(
        am5Flow.Sankey.new(root, {
          sourceIdField: "from",
          targetIdField: "to",
          valueField: "value",
          paddingRight: 150,
          nodeAlign: 'left',
          nodePadding: 100,
          nodeWidth: 8,
          linkTension: 0,
          idField: "id",
        })
      );
    
      series.links.template.setAll({
        fillOpacity: 0.55,
        fillStyle: "source",
        controlPointDistance: 0,
      });
    
      series.nodes.rectangles.template.adapters.add('tooltipText', function(tooltipText, target) {
        const links = target.dataItem._settings.incomingLinks || [];
        let toolTip = "";
    
        if (links && links.length > 0) {
          links.forEach((node) => {
            toolTip += `${node.dataContext.from} - ${node.dataContext.value} \n`;
          });
        } 
        return toolTip;
      });
    
    
      series.nodes.labels.template.setAll({
        text: "[bold]{name}: {sumIncoming}"
      });
    
      if (options && options.length > 0) {
        series.data.setAll(options);
      } else {
        series.data.setAll([]);
      }
    
      root.current = root;
      series.appear(1000, 500);
    }
  }, [config, sigmaData]);

  return (
    <div id="chartdiv" style={{ width: "100%", height: "98vh"}}></div>
  );
}

export default App;
