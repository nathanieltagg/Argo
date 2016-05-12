<!-- vertex shader -->
<script id="2d-vertex-shader" type="x-shader/x-vertex">
attribute vec2 a_position;
attribute vec2 a_texCoord;

uniform vec2 u_resolution;
varying vec2 v_texCoord;

void main() {

   // convert the rectangle from pixels to 0.0 to 1.0
   vec2 zeroToOne = a_position / u_resolution;

   // convert from 0->1 to 0->2
   vec2 zeroToTwo = zeroToOne * 2.0;

   // convert from 0->2 to -1->+1 (clipspace)
   vec2 clipSpace = zeroToTwo - 1.0;

   gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1); // Flips vertically?

   // pass the texCoord to the fragment shader
   // The GPU will interpolate this value between points.
    v_texCoord = a_texCoord;
}
</script>

<script id="stupidfill" type="x-shader/x-fragment">
precision mediump float;

void main() {
  gl_FragColor.r = 255.0;
  gl_FragColor.g = 0.0;
  gl_FragColor.b = 0.0;
  gl_FragColor.a = 255.0;
}

</script>


<script id="lutshade" type="x-shader/x-fragment">
precision mediump float;

uniform sampler2D inputtexture;
uniform sampler2D maptexture;

varying vec2 v_texCoord;

void main() {
  // inc is now the RGBA color of the input pixel, with each color encoded as a float from 0 to 1.
  vec4 inc = texture2D(inputtexture, v_texCoord);
  vec2 lookup_coords = vec2( (floor(inc.g*256.0)+0.5)/256.0 , (floor(inc.r*256.0)+0.5)/256.0 );
  gl_FragColor = texture2D(maptexture, lookup_coords);
}

</script>



<script id="lutshade-with-rms-cut" type="x-shader/x-fragment">
precision mediump float;

uniform sampler2D inputtexture;
uniform sampler2D maptexture;
uniform float pedestal_width_cut;

varying vec2 v_texCoord;

void main() {
  // inc is now the RGBA color of the input pixel, with each color encoded as a float from 0 to 1.
  vec4 inc = texture2D(inputtexture, v_texCoord);
  
  // 1d lookup.
  // float adc = 256.*(inc.r*255. + inc.g - 128.);  // True ADC value; typical -4096 to 4096.
  // float lookup_coord = adc/8192. + 0.5; // this is a proper 1:1 mapping, but doesn't use enough dynamic range.
  // vec2 lookup_coords = vec2(lookup_coord,0);
  
  // 2d lookup.
  // Just use r,g. Red is most-significant, green is least-significant.  X is least, Y is most.
  
  // July 27
  // Add a 0.5 pixel offset, to be sure that the nearest pixel we map to in the maptexture is the correct one!
  vec2 lookup_coords = vec2( (floor(inc.g*256.0)+0.5)/256.0 , (floor(inc.r*256.0)+0.5)/256.0 );
  
  // This doesn't work. I don't understand why not.
  // float adc = 256.*(inc.r*256. - 128. + inc.g);  // True ADC value; typical -4096 to 4096.

  // This DOES work and should give the correct ADC value in integers
  int g = int(inc.g*256.0);  
  int r = int(inc.r*256.0);
  int b = int(inc.b*256.0);
  int adc = (r-128)*256 + g;
  if(adc<0) adc = -adc; // abs(int) does not work, and type conversion not so good.
  
  
  int serviceboard = b/16;
  int rms = b - (serviceboard*16);
  int cut = int(float(rms)*pedestal_width_cut/2.0);
  
  
  if( adc < cut ) {
    lookup_coords=vec2(0.,0.5);  // set to be the maptexture color of adc=0.
     // color.r=0.; color.g=0.; color.b=0.;
   }
   vec4 color = texture2D(maptexture, lookup_coords);
  
  // Debug: This just draws our input texture.
  // color = texture2D(maptexture,v_texCoord);
  
  // Debug: this draws a little four-square texture to show me where the mapping is.
  // // Output color is RGBA color with colors encoded between 0 and 1.
  // color.r = 255.; color.g = 0.; color.b = 0.; color.a=255.;
  // if(v_texCoord.x>0.5 &&v_texCoord.y>0.5 ) { color.r = 0.; color.g = 255.; color.b = 0.; color.a=255.; }
  // if(v_texCoord.x<0.5  &&v_texCoord.y<0.5) { color.r = 0.; color.g = 0.; color.b = 255.; color.a=255.; }
  
  gl_FragColor = color;
}

</script>








































<script id="lutshade-with-noise-removal" type="x-shader/x-fragment">
precision mediump float;

uniform sampler2D inputtexture;
uniform sampler2D maptexture;
uniform int   do_noise_reject;
uniform int   do_bad_channel_flag;
varying vec2 v_texCoord;

void main() {
  // inc is now the RGBA color of the input pixel, with each color encoded as a float from 0 to 1.
  vec4 inc = texture2D(inputtexture, v_texCoord);
  
  
  // // This DOES work and should give the correct ADC value in integers
  int g = int(inc.g*255.0);
  int r = int(inc.r*255.0);
  int b = int(inc.b*255.0);
  
  // Subtract the noise which is stored in the blue channel.
  if(do_noise_reject>0 && b<0xff) {
    g = g - b + 128;
    if(g<0)   { r-=1; g+=256;}
    if(g>255) { r+=1; g-=256;}
  }
  if(b==0xff && do_bad_channel_flag==0) { g=0x80; r=0x80; } // dead channel - zero it out.
  
  vec2 lookup_coords = vec2( (float(g)+0.5)/256.0 , (float(r)+0.5)/256.0 );
  gl_FragColor = texture2D(maptexture, lookup_coords);
  

  if(b==0xff && do_bad_channel_flag==2) { gl_FragColor.r = 0.; gl_FragColor.g = 0.; gl_FragColor.b=0.; gl_FragColor.a=0.;} // dead channel - black out.
  
  // July 27
  // Add a 0.5 pixel offset, to be sure that the nearest pixel we map to in the maptexture is the correct one!
  // vec2 lookup_coords = vec2( (floor(inc.g*256.0)+0.5)/256.0 , (floor(inc.r*256.0)+0.5)/256.0 );

    
}

</script>
