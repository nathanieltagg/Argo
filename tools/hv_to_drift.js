SetHV = function(hv, temperature) 
{
    // computes field and drift velocity in cm/us, given temperature and hv.

    // Link to util::LArProperties::DriftVelocity() (code in LArSoft, lardata/Utilities/LArProperties_service.cc):
    // http://nusoft.fnal.gov/larsoft/doxsvn/html/classutil_1_1LArProperties.html#ae7778dccb5e6f6e3bdc839734b1232f8
    // Drift Velocity as a function of Electric Field and LAr Temperature
    // from : W. Walkowiak, NIM A 449 (2000) 288-294
    // Efield should have units of kV/cm
    // Temperature should have units of Kelvin
    var hv = hv || 70.0;
    var temperature = temperature || 87.302; // Kelvin
    
    var efield = hv /256.04; // 
    
    
    var tshift = -87.203+temperature;
    var xFit = 0.0938163-0.0052563*tshift-0.0001470*tshift*tshift;
    var uFit = 5.18406+0.01448*tshift-0.003497*tshift*tshift-0.000516*tshift*tshift*tshift;
    var vd;


    // Icarus Parameter Set, use as default
    var  P1 = -0.04640; // K^-1
    var  P2 = 0.01712;  // K^-1
    var  P3 = 1.88125;   // (kV/cm)^-1
    var  P4 =  0.99408;    // kV/cm
    var  P5 =  0.01172;   // (kV/cm)^-P6
    var  P6 =  4.20214;
    var  T0 =  105.749;  // K
        // Walkowiak Parameter Set
    var    P1W = -0.01481; // K^-1
    var  P2W = -0.0075;  // K^-1
    var   P3W =  0.141;   // (kV/cm)^-1
    var   P4W =  12.4;    // kV/cm
    var   P5W =  1.627;   // (kV/cm)^-P6
    var   P6W =  0.317;
    var   T0W =  90.371;  // K

    // From Craig Thorne . . . currently not documented
    // smooth transition from linear at small fields to 
    //     icarus fit at most fields to Walkowiak at very high fields
    if (efield < xFit) vd=efield*uFit;
    else if (efield<0.619) { 
     vd = ((P1*(temperature-T0)+1)
                 *(P3*efield*Math.log(1+P4/efield) + P5*Math.pow(efield,P6))
                 +P2*(temperature-T0));
    }
    else if (efield<0.699) {
     vd = 12.5*(efield-0.619)*((P1W*(temperature-T0W)+1)
               *(P3W*efield*Math.log(1+P4W/efield) + P5W*Math.pow(efield,P6W))
               +P2W*(temperature-T0W))+
       12.5*(0.699-efield)*((P1*(temperature-T0)+1)
               *(P3*efield*Math.log(1+P4/efield) + P5*Math.pow(efield,P6))
               +P2*(temperature-T0));
    }
    else {
     vd = ((P1W*(temperature-T0W)+1)
               *(P3W*efield*Math.log(1+P4W/efield) + P5W*Math.pow(efield,P6W))
               +P2W*(temperature-T0W));     
    }

    vd /= 10.; // vd is now in cm/us
    
    // Convert to standard units: cm per tick
    var drift_cm_per_tick = vd/2.0;  // 2.0 Mhz per tick
    
    return drift_cm_per_tick;
    // (0.3 cm/wire) / (0.081 cm/tdc)
    fTdcWirePitch = this.wire_pitch/ this.drift_cm_per_tick; // tdc per wire.
    
};

for(var temp = 80; temp < 87.302; temp +=0.1 ){
    console.log(temp,SetHV(70,temp));
}