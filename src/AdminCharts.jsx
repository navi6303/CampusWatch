import React from 'react';
import {BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer} from 'recharts';
import {categories,severities} from './domain';

export default function AdminCharts({rows}) {
  const chart = (title,keys,field)=><section className="panel chart"><h2>{title}</h2><ResponsiveContainer width="100%" height={230}><BarChart data={keys.map(name=>({name,count:rows.filter(r=>r[field]===name).length}))} layout="vertical" margin={{right:20}}><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="name" width={106} tick={{fontSize:10}}/><Tooltip/><Bar isAnimationActive={false} name="Reports" dataKey="count" fill="#0297DE" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></section>;
  return <div className="two">{chart('Incidents by category',[...new Set([...categories,...rows.map(r=>r.category)])],'category')}{chart('Incidents by severity',severities,'severity')}</div>;
}
