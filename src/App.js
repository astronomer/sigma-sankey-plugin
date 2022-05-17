import "./App.css";

import { useMemo, useLayoutEffect, useRef } from "react";
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
  { name: "custom", type: "text", secure: false, multiline: true, placeholder: "ex: \n node name, #hexColor \n node name2, #hexColor2"},
  { name: "opacity", type: "text", secure: false, multiline: false, placeholder: "A value between 0 and 1. Default: 0.55 "},
  { name: "linkTension", type: "text", secure: false, multiline: false, placeholder: "A value between 0 and 1. Default: 0"},
]);

function App() {
  const config = useConfig();
  const sigmaData = useElementData(config.source);
  const chart = useRef(null);

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
          const value = sigmaData[measures[i]][j];
          const dataPoint = {key: `${from}-${to}`, from, to, value };
          dataMap.push(dataPoint)
        }
      }

      // reduce the data to unique paths
      let data = dataMap.reduce((res, obj) => {
        if (!(obj.key in res)) {
          res.push(res[obj.key] = obj);
        } else {
          res[obj.key].value += obj.value;
        }
        return res;
      }, []);

      return data;
    }
  }, [config, sigmaData]);

  useLayoutEffect(() => {
    // hardcoded colors
    const customOpacity = config.opacity;
    const customLinkTension = config.linkTension;

    const customColors = [
      {id: "opp created", fill: 0xD8D4D5},
      {id: "stage 2", fill: 0xC89933},
      {id: "stage 2, trial", fill: 0xC89933},
      {id: "no Stage 2", fill: 0xDB6C79},
      {id: "no Stage 2, no trial", fill: 0xDB6C79},
      {id: "won, astro deployed", fill: 0x1B9D51},
    ];

    const custom = config.custom;
    if (custom) {
      custom.split("\n").forEach((setting) => {
        const [name, color] = setting.split(',');
        if (name.trim() !== "") {
          const found = customColors.findIndex(el => el.id === name.trim());
          if (found >= 0) {
            customColors[found].fill = color.trim();
          } else {
            customColors.push({ id: name.trim(), fill: `${color.trim()}`});
          }
        }
      });
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
        nodeWidth: 10,
        linkTension: customLinkTension || 0,
        idField: "id",
      })
    );
  
    series.links.template.setAll({
      fillOpacity: customOpacity.trim() || 0.55,
      fillStyle: "source",
      controlPointDistance: 0,
    });
  
    // tooltip adapter
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

    // node adapter custom fill logic based on id
    series.nodes.rectangles.template.adapters.add('fill', function (fill, target) {
      const data = target._dataItem;
      if (data.dataContext) {
        const { id } = data.dataContext;
        const found = customColors.filter(el => el.id.toLowerCase() === id.toLowerCase())[0];
        return found ? am5.color(found.fill) : fill;
      }

      return fill;
    });

    // node label custom text - root node different count than children nodes
    series.nodes.labels.template.adapters.add('text', function(label, target) {
      const node = target._dataItem;
      if (node && node._settings) {
        const nodeSettings = node._settings;
        const { name } = nodeSettings;

        if (nodeSettings.incomingLinks) {
          return `${name}: ${nodeSettings.sumIncoming}`;
        } else if (nodeSettings.outgoingLinks) {
          return `${name}: ${nodeSettings.sumOutgoing}`;
        }
      }
    });

    // link adapter for custom fill based on id
    series.links.template.adapters.add('fill', function(fill, target) {
      const link = target._dataItem;
      if (link && link.dataContext) {
        const { from } = link.dataContext;
        const found = customColors.filter(el => el.id.toLowerCase() === from.toLowerCase())[0];
        return found ? am5.color(found.fill) : fill;
      }
      return fill;
    });
  
    if (options && options.length > 0) {
      series.data.setAll(options);
    } else {
      series.data.setAll([]);
    }
  
    chart.current = root
    series.appear(1000, 500);

    return () => {root.dispose()}
  }, [options, config]);

  return (
    <div id="chartdiv" style={{ width: "100%", height: "100vh"}}></div>
  );
}

export default App;
