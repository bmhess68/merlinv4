import L from 'leaflet';
import { policeCarIcon, k9Icon, helicopterIcon, esuIcon, boatIcon, ambulanceIcon, ladderIcon, rescueIcon, starchaseIcon, tankerIcon, engineIcon, nyspIcon, nypdIcon, rotateIcon, fbiIcon, rav4Icon, ctspIcon, detcarIcon, wcpdIcon } from './icons';

export const icons = {
    policeCar: (heading) => rotateIcon(policeCarIcon, heading),
    k9: (heading) => rotateIcon(k9Icon, heading),
    helicopter: (heading) => rotateIcon(helicopterIcon, heading),
    esu: (heading) => rotateIcon(esuIcon, heading),
    boat: (heading) => rotateIcon(boatIcon, heading),
    ambulance: (heading) => rotateIcon(ambulanceIcon, heading),
    ladder: (heading) => rotateIcon(ladderIcon, heading),
    rescue: (heading) => rotateIcon(rescueIcon, heading),
    starchase: (heading) => rotateIcon(starchaseIcon, heading),
    tanker: (heading) => rotateIcon(tankerIcon, heading),
    engine: (heading) => rotateIcon(engineIcon, heading),
    nysp: (heading) => rotateIcon(nyspIcon, heading),
    wcpd: (heading) => rotateIcon(wcpdIcon, heading),
    rav4: (heading) => rotateIcon(rav4Icon, heading),
    detcar: (heading) => rotateIcon(detcarIcon, heading),
    ctsp: (heading) => rotateIcon(ctspIcon, heading),
    fbi: (heading) => rotateIcon(fbiIcon, heading),
    nypd: (heading) => rotateIcon(nypdIcon, heading),
    
};

export const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
};
