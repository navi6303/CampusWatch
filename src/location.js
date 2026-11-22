import {useCallback,useEffect,useRef,useState} from 'react';

const options = {enableHighAccuracy:true,timeout:12000,maximumAge:3000};
const failures = {
  1:'Location permission was denied. Allow it in browser settings or choose a map point.',
  2:'Your device could not determine its position. Try outdoors or choose a map point.',
  3:'The location request timed out. Try again or choose a map point.'
};

export function useLocation() {
  const [fix,setFix]=useState(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [tracking,setTracking]=useState(false);
  const generation=useRef(0), watch=useRef(null);
  const cancel=useCallback(()=>{
    generation.current++;
    if(watch.current!==null) navigator.geolocation?.clearWatch(watch.current);
    watch.current=null;
  },[]);
  useEffect(()=>cancel,[cancel]);
  function stop() {
    cancel();setTracking(false);setBusy(false);setMessage('');setFix(null);
  }
  function request(live,onFix) {
    cancel();setMessage('');setFix(null);setTracking(false);setBusy(false);
    if(!window.isSecureContext || !navigator.geolocation) {
      setMessage('Location requires HTTPS or localhost and a browser that supports GPS. Choose a map point.');return;
    }
    const ticket=generation.current;
    setBusy(true);setTracking(live);
    function success({coords,timestamp}) {
      if(ticket!==generation.current)return;
      const next={lat:coords.latitude,lng:coords.longitude,accuracy:coords.accuracy,timestamp};
      setBusy(false);setFix(next);setMessage('');
      onFix?.(next);
    }
    function failure(error) {
      if(ticket!==generation.current)return;
      setBusy(false);setMessage(failures[error.code]||'Location unavailable. Choose a map point.');setFix(null);
      if(error.code===1){cancel();setTracking(false);}
    }
    if(live) watch.current=navigator.geolocation.watchPosition(success,failure,options);
    else navigator.geolocation.getCurrentPosition(success,failure,options);
  }
  return {fix,busy,message,tracking,request,stop};
}
