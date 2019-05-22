double SetHV(double hv, double temperature) 
{
    // computes field and drift velocity in cm/us, given temperature and hv.

    // Link to util::LArProperties::DriftVelocity() (code in LArSoft, lardata/Utilities/LArProperties_service.cc):
    // http://nusoft.fnal.gov/larsoft/doxsvn/html/classutil_1_1LArProperties.html#ae7778dccb5e6f6e3bdc839734b1232f8
    // Drift Velocity as a function of Electric Field and LAr Temperature
    // from : W. Walkowiak, NIM A 449 (2000) 288-294
    // Efield should have units of kV/cm
    // Temperature should have units of Kelvin
    // hv = (hv>0) || 70.0;
    // temperature = (temperature>0) || 87.302; // Kelvin
    
    double efield = hv /256.04; // 
    
    
    double tshift = -87.203+temperature;
    double xFit = 0.0938163-0.0052563*tshift-0.0001470*tshift*tshift;
    double uFit = 5.18406+0.01448*tshift-0.003497*tshift*tshift-0.000516*tshift*tshift*tshift;
    double vd;


    // Icarus Parameter Set, use as default
    double  P1 = -0.04640; // K^-1
    double  P2 = 0.01712;  // K^-1
    double  P3 = 1.88125;   // (kV/cm)^-1
    double  P4 =  0.99408;    // kV/cm
    double  P5 =  0.01172;   // (kV/cm)^-P6
    double  P6 =  4.20214;
    double  T0 =  105.749;  // K
        // Walkowiak Parameter Set
    double    P1W = -0.01481; // K^-1
    double  P2W = -0.0075;  // K^-1
    double   P3W =  0.141;   // (kV/cm)^-1
    double   P4W =  12.4;    // kV/cm
    double   P5W =  1.627;   // (kV/cm)^-P6
    double   P6W =  0.317;
    double   T0W =  90.371;  // K

    // From Craig Thorne . . . currently not documented
    // smooth transition from linear at small fields to 
    //     icarus fit at most fields to Walkowiak at very high fields
    if (efield < xFit) vd=efield*uFit;
    else if (efield<0.619) { 
     vd = ((P1*(temperature-T0)+1)
                 *(P3*efield*log(1+P4/efield) + P5*pow(efield,P6))
                 +P2*(temperature-T0));
    }
    else if (efield<0.699) {
     vd = 12.5*(efield-0.619)*((P1W*(temperature-T0W)+1)
               *(P3W*efield*log(1+P4W/efield) + P5W*pow(efield,P6W))
               +P2W*(temperature-T0W))+
       12.5*(0.699-efield)*((P1*(temperature-T0)+1)
               *(P3*efield*log(1+P4/efield) + P5*pow(efield,P6))
               +P2*(temperature-T0));
    }
    else {
     vd = ((P1W*(temperature-T0W)+1)
               *(P3W*efield*log(1+P4W/efield) + P5W*pow(efield,P6W))
               +P2W*(temperature-T0W));     
    }

    vd /= 10.; // vd is now in cm/us
    
    // Convert to standard units: cm per tick
    double drift_cm_per_tick = vd/2.0;  // 2.0 Mhz per tick
    
    return drift_cm_per_tick;
    // // (0.3 cm/wire) / (0.081 cm/tdc)
    // fTdcWirePitch = this.wire_pitch/ this.drift_cm_per_tick; // tdc per wire.
    
};

double hv_a = -3.17884e-06;
double hv_b = 0.00097196;
double hv_c = 0.00527371;

double simple_drift(double hv)
{
    return hv_a*hv*hv + hv*hv_b + hv_c;
}

double hv_of_drift(double drift)
{
    double c = hv_c - drift;
    return (-hv_b + fabs(sqrt(hv_b*hv_b - 4*hv_a*c)))/(2*hv_a);
}


TGraph* gr_temp;
TGraph* gr_volt;
void hv_to_drift(void)
{
    gr_temp = new TGraph();
    int i = 0;
    for(double temp = 80; temp < 87.302; temp +=0.1 ){
        gr_temp->SetPoint(i++,temp,SetHV(70,temp));
    }
    gr_temp->SetMarkerStyle(20);
    gr_temp->Fit("pol1");
    gr_temp->Draw();

    new TCanvas;
    gr_volt = new TGraph();
    i = 0;
    for(double hv = 40; hv < 100; hv +=1 ){
        double drift = SetHV(hv,87);
        gr_volt->SetPoint(i++,hv,SetHV(hv,87));
        double sdrift = simple_drift(hv);
        double hv2 = hv_of_drift(drift);
        std::cout <<hv << "\t" << drift << "\t" << sdrift << "\t" << hv2 << std::endl;
    }
    gr_volt->SetMarkerStyle(20);
    gr_volt->Fit("pol2");
    gr_volt->Draw();



}    

