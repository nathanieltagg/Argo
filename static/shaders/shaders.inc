
<script id="three-vertex-shader" type="x-shader/x-fragment">
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

   void main() {
       vUv = uv;
       vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
       vPosition = (modelMatrix *
           vec4(position,1.0)).xyz;
       gl_Position = projectionMatrix * mvPosition;
      vec3 transformedNormal = normalMatrix *  vec3( normal );
      vNormal = normalize( transformedNormal );
      vViewDirection = normalize(mvPosition.xyz);
   }
</script>


















<script id="three-fragment-shader-time-range" type="x-shader/x-fragment">
// This variant allows multiple time-domain textures, which are used to scroll through tdc count

precision mediump float;

// set of textures in tdc dimention, consecutive.  The y-coordinate of all of these should be identical.

uniform float     texture_start_chan;
uniform float     texture_size_chan;

uniform sampler2D texture0;
uniform float     texture0_start_tdc;
uniform float     texture0_size_tdc;
uniform sampler2D texture1;
uniform float     texture1_start_tdc;
uniform float     texture1_size_tdc;
uniform sampler2D texture2;
uniform float     texture2_start_tdc;
uniform float     texture2_size_tdc;
uniform sampler2D texture3;
uniform float     texture3_start_tdc;
uniform float     texture3_size_tdc;
uniform sampler2D texture4;
uniform float     texture4_start_tdc;
uniform float     texture4_size_tdc;
// uniform sampler2D texture5;
// uniform float     texture5_start_tdc;
// uniform float     texture5_size_tdc;

uniform sampler2D maptexture;
uniform int   do_noise_reject;
uniform int   do_bad_channel_flag;

// toggle transparency by view diretion:
uniform int   do_trans_view_direction_flag;

// the stuff I want to draw:
uniform float chan_start;
uniform float chan_end;
uniform float tdc_start;
uniform float tdc_end;
uniform float trans_start;
uniform float trans_end;

uniform float trans_cut_low;
uniform float trans_cut_high;
uniform float trans_cut_fade_width;
uniform float tdc_cut_low;
uniform float tdc_cut_high;
uniform float tdc_cut_fade_width;

uniform int    flip;

// uniform vec2 crop_start; // x,y of start crop region in (wire,tdc) i.e. rotated
// uniform vec2 crop_end;   // x,y of stop crop region in (wire,tdc) i.e. rotated

varying vec2  vUv;
varying vec3  vPosition;
varying vec3  vNormal;
varying vec3  vViewDirection;

vec4 get_encoded_adc_value(float tdc, float v)
{
  // find which texture
  vec2 uv_final;
  uv_final.y = v;
  if(tdc< (texture0_start_tdc + texture0_size_tdc)) {
    uv_final.x = (tdc-texture0_start_tdc) / texture0_size_tdc ;
    return texture2D(texture0, uv_final);
  
  } else if(tdc< (texture1_start_tdc + texture1_size_tdc)) {
    uv_final.x = (tdc-texture1_start_tdc) / texture1_size_tdc ;
    return texture2D(texture1, uv_final);

  } else if(tdc< (texture2_start_tdc + texture2_size_tdc)) {
    uv_final.x = (tdc-texture2_start_tdc) / texture2_size_tdc ;
    return texture2D(texture2, uv_final);

  } else if(tdc< (texture3_start_tdc + texture3_size_tdc)) {
    uv_final.x = (tdc-texture3_start_tdc) / texture3_size_tdc ;
    return texture2D(texture3, uv_final);

  } else if(tdc< (texture4_start_tdc + texture4_size_tdc)) {
    uv_final.x = (tdc-texture4_start_tdc) / texture4_size_tdc ;
    return texture2D(texture4, uv_final);
  } else 
    return vec4(0.,0.,1.,0.); // return bad channel. Shouldn't ever happen.
}

vec4 most_extreme_value(vec4 v1, vec4 v2) 
{
  // In our RGB coded space, which value is more interesting... i.e further from zero?
  float f1 = abs((v1.g-0.5)*256.0 + (v1.r-0.5));
  float f2 = abs((v2.g-0.5)*256.0 + (v2.r-0.5));
  if(f1>f2) return v1;
  else      return v2;
}


void main() {
  // vUv is the normalized U,V coordinate in the object which nominally
  // maps to inputtexture(u,v).  However, we're going to manipulate it:


  // vec2 uv_final;

  // wire coordinate (x in source texture, y in UV coordinate system used by the polygon)
  float wire = mix(chan_start,chan_end,vUv.x); //(vUv.x*(chan_end-chan_start) + chan_start);   // x*end (1-x)*start
  // invert the UV texture coordinates so that time is vertical.
  // uv_final.y = 1.-(wire-texture_start_chan)/texture_size_chan;
  float finalv = 1.-(wire-texture_start_chan)/texture_size_chan;

  // tdc coordinate for this pixel
  float v = vUv.y;
  if(flip>0) v=1.-vUv.y;
  float tdc = v*(tdc_end-tdc_start)+tdc_start;

  // Check for reasonable bounds; we may have scrolled outside the reasonable area.
  if(tdc < texture0_start_tdc) {
    // Scrolling the t0 past the limits of the data
    // Shouldn't ever happen.
    discard; 
    // gl_FragColor = vec4(0.0, 1.0, 0.0, 0.0);
    // return;
  }
  if(tdc>=(texture4_start_tdc + texture4_size_tdc)) {
    // discard;
    // l_FragColor = vec4(0.0, 1.0, 0.0, 0.0);
    // return;
  }


  // Fade or discard if we're outside the trans cut region.

  float trans = mix(trans_start,trans_end,vUv.x); 
  float fade = smoothstep(trans_cut_low -trans_cut_fade_width, trans_cut_low +trans_cut_fade_width, trans);
  fade *= (1.0-smoothstep(trans_cut_high-trans_cut_fade_width, trans_cut_high+trans_cut_fade_width, trans) );
  fade *=      smoothstep(tdc_cut_low   -tdc_cut_fade_width,   tdc_cut_low   +tdc_cut_fade_width, tdc) ;
  fade *= (1.0-smoothstep(tdc_cut_high  -tdc_cut_fade_width,   tdc_cut_high  +tdc_cut_fade_width, tdc) );

  if(fade <= 0.99) discard;

  // How far zoomed in are we?  If we're zoomed out, it's hard to see detail.
  // for now, concentrate only on the TDC coordinate, since it's the most compressed when looking at a perspective view 
  // of the wire data.

  // int zoom = 0;
  // float dUdx = dFdx(vUv.x); // Difference in U between this pixel and the one to the right.
  // float dUdy = dFdy(vUv.x); // Difference in U between this pixel and the one to the right.
  // float dU = sqrt(dUdx*dUdx + dUdy*dUdy);
  // if(dU*(trans_end-trans_start)>1.0) zoom =1;
  float dVdx = dFdx(vUv.y); // Difference in U between this pixel and the one to the right.
  float dVdy = dFdy(vUv.y); // Difference in U between this pixel and the one to the right.
  float dV = sqrt(dVdx*dVdx + dVdy*dVdy);
  float pixel_ratio_y = (dV*(tdc_end-tdc_start));
  // This value should crudely represent how many TDC counts are in a single screen pixel.


  vec4 inc = get_encoded_adc_value(tdc, finalv);

  // Pixel "averaging". This finds the most extreme value in the search range, and uses it.
  // This shows features much more strongly when zoomed out.

  // Pixel ratios of about 6 or so are good enough for retina screen resolutions in the standard wireviews.
  // for the 3d view, where the UV is much more compressed, this can go up to factors of 20 or 30, I think.  But I'm not 
  // going to sample THAT much.. too many calcs!  This has to run on chromebooks!
  if(pixel_ratio_y>2.0) {
    inc = most_extreme_value(inc, get_encoded_adc_value(tdc+1.0, finalv));
  }
  if(pixel_ratio_y>3.0) {
    inc = most_extreme_value(inc, get_encoded_adc_value(tdc-1.0, finalv));    
  }
  if(pixel_ratio_y>4.0) {
    inc = most_extreme_value(inc, get_encoded_adc_value(tdc+2.0, finalv));    
  }
  if(pixel_ratio_y>5.0) {
    inc = most_extreme_value(inc, get_encoded_adc_value(tdc-2.0, finalv));    
  }
  if(pixel_ratio_y>6.0) {
    inc = most_extreme_value(inc, get_encoded_adc_value(tdc+3.0, finalv));    
  }
  if(pixel_ratio_y>7.0) {
    inc = most_extreme_value(inc, get_encoded_adc_value(tdc-3.0, finalv));    
  }
 
   if(pixel_ratio_y>10.0) {
    inc = most_extreme_value(inc, get_encoded_adc_value(tdc+5.0, finalv));    
  }
  if(pixel_ratio_y>11.0) {
    inc = most_extreme_value(inc, get_encoded_adc_value(tdc-5.0, finalv));    
  }
  if(pixel_ratio_y>12.0) {
    inc = most_extreme_value(inc, get_encoded_adc_value(tdc+6.0, finalv));    
  }
  if(pixel_ratio_y>13.0) {
    inc = most_extreme_value(inc, get_encoded_adc_value(tdc-6.0, finalv));    
  }
 
  // if(pixel_ratio_y>16.0) {
  //   inc = most_extreme_value(inc, get_encoded_adc_value(tdc+8.0, finalv));    
  // }
  // if(pixel_ratio_y>17.0) {
  //   inc = most_extreme_value(inc, get_encoded_adc_value(tdc-8.0, finalv));    
  // }

  // if(pixel_ratio_y>20.0) {
  //   inc = most_extreme_value(inc, get_encoded_adc_value(tdc+10.0, finalv));    
  //   inc = most_extreme_value(inc, get_encoded_adc_value(tdc-10.0, finalv));    
  // }

  // if(pixel_ratio_y>30.0) {
  //   inc = most_extreme_value(inc, get_encoded_adc_value(tdc+15.0, finalv));    
  //   inc = most_extreme_value(inc, get_encoded_adc_value(tdc-15.0, finalv));    
  // }



  // if(tdc < texture0_start_tdc) {
  //   // Scrolling the t0 past the limits of the data
  //   gl_FragColor = vec4(0.0, 1.0, 0.0, 0.0);
  //   return;

  // } else if(tdc< (texture0_start_tdc + texture0_size_tdc)) {
  //   uv_final.x = (tdc-texture0_start_tdc) / texture0_size_tdc ;
  //   inc = texture2D(texture0, uv_final);
  
  // } else if(tdc< (texture1_start_tdc + texture1_size_tdc)) {
  //   uv_final.x = (tdc-texture1_start_tdc) / texture1_size_tdc ;
  //   inc = texture2D(texture1, uv_final);

  // } else if(tdc< (texture2_start_tdc + texture2_size_tdc)) {
  //   uv_final.x = (tdc-texture2_start_tdc) / texture2_size_tdc ;
  //   inc = texture2D(texture2, uv_final);

  // } else if(tdc< (texture3_start_tdc + texture3_size_tdc)) {
  //   uv_final.x = (tdc-texture3_start_tdc) / texture3_size_tdc ;
  //   inc = texture2D(texture3, uv_final);

  // } else if(tdc< (texture4_start_tdc + texture4_size_tdc)) {
  //   uv_final.x = (tdc-texture4_start_tdc) / texture4_size_tdc ;
  //   inc = texture2D(texture4, uv_final);

  // // } else if(tdc< (texture5_start_tdc + texture5_size_tdc)) {
  // //   uv_final.x = (tdc-texture5_start_tdc) / texture5_size_tdc ;
  // //   inc = texture2D(texture5, uv_final);

  // } else {
  //   // Scroll past limits of data

  //   gl_FragColor = vec4(0,0,0,0);
  //   //gl_FragColor = vec4(1,0,0,1);
  //   return;
  // }

  
  


  
  // Note that full-value is 1.0, so need to multiply to 255 to get a proper integer address.
  int g = int(inc.g*255.0);
  int r = int(inc.r*255.0);
  int b = int(inc.b*255.0);

  // if(g==256) {
  //    // Shouldn't happen!
  //    gl_FragColor = vec4(1,0,0,0);
  //    return;
  // }
  
  // Subtract the noise which is stored in the blue channel.
  if(do_noise_reject>0 && b<0xff) {
    g = g - b + 128;
    if(g<0)   { r-=1; g+=256;}
    if(g>255) { r+=1; g-=256;}
  }

  // Dead channels.
  if(b>=0xff && do_bad_channel_flag==0) { g=0x80; r=0x80; } // dead channel - zero it out.

  // Ok, we have our final value of the ADC for this pixel coded as GR; look that shit up in the lookup table.
  vec2 lookup_coords = vec2( (float(g)+0.5)/256.0 , (float(256-r)+0.5)/256.0 );
  
  gl_FragColor = texture2D(maptexture, lookup_coords);
  gl_FragColor.a *= fade;  // make edges transparent
  // gl_FragColor = mix( vec4(1,0,0,1), vec4(0,1,0,1) , fade ); // Red instead of transparent


  if(b>=0xff && do_bad_channel_flag==2) { gl_FragColor.r = 0.; gl_FragColor.g = 0.; gl_FragColor.b=0.; gl_FragColor.a=1.;} // dead channel - black, no opacity.

  // Are we looking at it face-on?
  if(do_trans_view_direction_flag>0) {
    float faceon =  abs(dot( vNormal, vViewDirection));
    gl_FragColor.a *=faceon*faceon*faceon;
  }

   // if(pixel_ratio_y>18.0) { gl_FragColor.r = 1.; gl_FragColor.g = 0.; gl_FragColor.b=0.; gl_FragColor.a=1.;} 

} 

</script>


















